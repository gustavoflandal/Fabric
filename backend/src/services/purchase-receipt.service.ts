import { Prisma, StockMovementType, WarehouseTaskType } from '@prisma/client';
import { prisma } from '../config/database';
import stockService from './stock.service';
import { eventBus, SystemEvents } from '../events/event-bus';
import { AppError } from '../middleware/error.middleware';
import { isModuleEnabled } from './licensed-module.service';
import {
  SEQUENCE_PREFIXES,
  nextDocumentNumber,
} from './document-sequence.service';
import {
  RECEIPT_TASK_REFERENCE_TYPE,
  assertChainOrderResolved,
  assertTaskIsOpen,
  createReceiptTaskChain,
  deleteTasksForReceipt,
  loadTaskForUpdate,
  markTaskCompleted,
  markTaskStarted,
} from './warehouse-task.service';

export interface CreatePurchaseReceiptDto {
  purchaseOrderId: string;
  receiptDate: string;
  invoiceNumber?: string;
  notes?: string;
  items: {
    orderItemId: string;
    productId: string;
    quantityReceived: number;
    notes?: string;
    /**
     * ✅ FASE 5 do plano do WMS — O LOTE LIDO NA CONFERÊNCIA.
     *
     * Os três campos são capturados no MESMO momento que `quantityReceived`:
     * conferir é ter a caixa na mão e ler a etiqueta do fabricante. Adiar a
     * captura para a alocação obrigaria o operador a reabrir o palete.
     *
     * OBRIGATORIEDADE POR PRODUTO, não por payload: `lotNumber` é exigido (400)
     * quando `Product.lotTracked` é `true`, e IGNORADO quando não é — mandar
     * lote de produto que não controla lote não é erro, é ruído de um cliente
     * genérico, e recusar o recebimento por causa disso seria pior do que
     * descartar o campo. O Joi não tem como decidir isso: a regra depende de uma
     * flag que só existe no banco.
     */
    lotNumber?: string | null;
    manufacturedAt?: string | null;
    expiresAt?: string | null;
  }[];
}

/**
 * F4.5 — entrada de uma conclusão (parcial ou total) de tarefa de `ALOCACAO`.
 * `receiptItemId` é explícito e não derivado da tarefa: a cadeia gerada por
 * F4.3 tem UMA tarefa de `ALOCACAO` por recebimento (não uma por item), então
 * é a chamada que diz QUAL item conferido está sendo endereçado — e um mesmo
 * recebimento pode ter dois itens do mesmo produto, o que tornaria
 * `task.productId` ambíguo mesmo se estivesse preenchido.
 */
export interface CompletePutawayDto {
  receiptItemId: string;
  storagePositionId: string;
  quantity: number;
}

export class PurchaseReceiptService {
  /**
   * Registra recebimento de pedido de compra
   *
   * ✅ F4.3 do plano do WMS (WMS_IMPLEMENTATION_ANALYSIS.md, seção 5, Fase 4;
   * seção 3.3 de 04_ARQUITETURA_MODULAR_LICENCIAMENTO.md): este método tem
   * DOIS comportamentos, decididos por um único branch (`isModuleEnabled`),
   * não por dois services paralelos — a duplicação de service é justamente o
   * risco registrado na tabela de riscos do plano ("dois caminhos que divergem
   * com o tempo, um deles sub-testado").
   *
   *   SEM WMS licenciado → comportamento IDÊNTICO ao de sempre: recebimento +
   *     itens na transação, `status` default (`PENDING`), entrada de estoque
   *     `IN` sem posição por item, custo médio atualizado em seguida. Nenhuma
   *     linha deste caminho foi alterada por esta fase.
   *
   *   COM WMS licenciado → o recebimento nasce `CONFERIDO` (a conferência de
   *     quantidade É a criação dos itens com `acceptedQty`) e ganha a cadeia
   *     DESCARGA → CONFERENCIA → ETIQUETAGEM → QUARENTENA → ALOCACAO. NENHUMA
   *     movimentação de estoque é registrada aqui: o material está fisicamente
   *     na doca, não endereçado, e dar entrada no saldo antes de existir
   *     endereço é exatamente a mentira que o WMS existe para eliminar. A
   *     entrada acontece em `completePutaway()`.
   *
   * O que é COMUM aos dois caminhos e não se moveu: a validação de quantidade
   * contra o pedido, o incremento de `PurchaseOrderItem.receivedQty` (o pedido
   * foi recebido em ambos os casos — o que muda é onde o material está, não se
   * chegou), `updateOrderStatus()` e o evento `PURCHASE_ORDER_RECEIVED`.
   */
  async create(data: CreatePurchaseReceiptDto, userId: string) {
    // Buscar pedido
    const order = await prisma.purchaseOrder.findUnique({
      where: { id: data.purchaseOrderId },
      include: {
        items: true,
        supplier: true,
      },
    });

    if (!order) {
      throw new AppError(404, 'Pedido de compra não encontrado');
    }

    if (order.status === 'CANCELLED') {
      throw new AppError(400, 'Não é possível receber pedido cancelado');
    }

    // Validar itens
    for (const item of data.items) {
      const orderItem = order.items.find(oi => oi.id === item.orderItemId);

      if (!orderItem) {
        throw new AppError(404, `Item ${item.orderItemId} não encontrado no pedido`);
      }

      const totalReceived = orderItem.receivedQty + item.quantityReceived;

      if (totalReceived > orderItem.quantity) {
        throw new AppError(
          400,
          `Quantidade recebida (${totalReceived}) excede quantidade pedida (${orderItem.quantity}) ` +
          `para o produto ${item.productId}`
        );
      }
    }

    // ✅ FASE 5 — VALIDAÇÃO DE LOTE NA CONFERÊNCIA.
    //
    // Fora da transação e junto das outras validações de payload, pelo mesmo
    // critério: é uma checagem que não depende de estado que possa mudar entre
    // aqui e a escrita (a flag do produto é cadastro, não saldo), e falhar antes
    // de abrir transação é o caminho barato.
    //
    // A checagem NÃO olha `isModuleEnabled('WMS')`: lote controlado é uma
    // afirmação sobre o PRODUTO ("este material é rastreado por lote"), não
    // sobre o módulo licenciado. Uma instalação sem WMS que marque um produto
    // como `lotTracked` continua obrigada a informar o número do lote no
    // recebimento — o que ela não tem é endereço para guardá-lo.
    const lotTrackedProducts = await prisma.product.findMany({
      where: { id: { in: data.items.map((item) => item.productId) }, lotTracked: true },
      select: { id: true, code: true },
    });
    const lotTrackedById = new Map(lotTrackedProducts.map((p) => [p.id, p.code]));

    for (const item of data.items) {
      const code = lotTrackedById.get(item.productId);

      if (code && !item.lotNumber?.trim()) {
        throw new AppError(
          400,
          `Produto ${code} tem controle de lote: informe o número do lote na conferência.`
        );
      }
    }

    // F4.3 — O BRANCH. Lido uma vez, antes da transação: `isModuleEnabled` bate
    // num cache em memória carregado no boot (licenciamento é configuração de
    // instalação, não filtro por request), então isto não é uma query a mais.
    const wmsEnabled = await isModuleEnabled('WMS');

    // Criar recebimento em transação
    const receipt = await prisma.$transaction(async (tx) => {
      // ✅ F4.7 — NUMERAÇÃO ATÔMICA. Antes era
      //
      //     const count = await prisma.purchaseReceipt.count();
      //     const receiptNumber = `REC-${ano}-${pad(count + 1)}`;
      //
      // FORA da transação, com três defeitos (não atômico, reaproveita número
      // após cancelamento, não reinicia por ano) detalhados em
      // `document-sequence.service.ts`. A geração passa para DENTRO da
      // transação e para o primeiro lugar dela: a sequência é o lock mais
      // externo (ver a nota de ordem de lock naquele arquivo), e segurá-la
      // enquanto se espera por lock de saldo faria da numeração um gargalo.
      const receiptNumber = await nextDocumentNumber(
        tx,
        SEQUENCE_PREFIXES.PURCHASE_RECEIPT
      );

      // Criar recebimento
      const newReceipt = await tx.purchaseReceipt.create({
        data: {
          receiptNumber,
          orderId: data.purchaseOrderId,
          receiptDate: new Date(data.receiptDate),
          receivedBy: userId,
          // F4.2 — estado intermediário. Só o caminho COM WMS o usa; sem WMS o
          // recebimento continua nascendo `PENDING` (o default da coluna), que
          // é o comportamento que sempre existiu.
          status: wmsEnabled ? 'CONFERIDO' : undefined,
          // PurchaseReceipt não tem coluna própria para nota fiscal - guardamos
          // junto das observações em vez de adicionar uma migration só pra isso.
          notes: data.invoiceNumber
            ? `NF: ${data.invoiceNumber}${data.notes ? ` - ${data.notes}` : ''}`
            : data.notes,
          items: {
            // O DTO só recebe uma quantidade recebida por item (sem fluxo de
            // aceite/rejeição do lado do cliente ainda); todo o recebido entra
            // como aceito. acceptedQty é o que de fato entra em estoque/custo.
            create: data.items.map(item => ({
              orderItemId: item.orderItemId,
              productId: item.productId,
              quantity: item.quantityReceived,
              acceptedQty: item.quantityReceived,
              rejectedQty: 0,
              notes: item.notes,
              // ✅ Fase 5 — só grava lote de produto que CONTROLA lote. Para os
              // demais os três campos são descartados aqui, num ponto só: gravar
              // "L-2026-001" num item cujo produto não é rastreado criaria um
              // dado que nada lê, que nenhum `Lot` vai nascer de, e que a
              // primeira auditoria interpretaria como rastreabilidade que não
              // existe.
              ...(lotTrackedById.has(item.productId)
                ? {
                    lotNumber: item.lotNumber!.trim(),
                    manufacturedAt: item.manufacturedAt
                      ? new Date(item.manufacturedAt)
                      : null,
                    expiresAt: item.expiresAt ? new Date(item.expiresAt) : null,
                  }
                : {}),
            })),
          },
        },
        include: {
          items: {
            include: {
              product: true,
              orderItem: true,
            },
          },
          order: {
            include: {
              supplier: true,
            },
          },
        },
      });

      // Atualizar quantidade recebida nos itens do pedido
      for (const item of data.items) {
        const orderItem = order.items.find(oi => oi.id === item.orderItemId);
        
        await tx.purchaseOrderItem.update({
          where: { id: item.orderItemId },
          data: {
            receivedQty: orderItem!.receivedQty + item.quantityReceived,
          },
        });
      }

      // F4.3 — a cadeia de tarefas nasce na MESMA transação que o recebimento.
      // Um recebimento `CONFERIDO` sem tarefas seria um recebimento que ninguém
      // consegue endereçar e que nunca daria entrada em estoque — estado pior
      // do que a criação inteira falhar.
      if (wmsEnabled) {
        await createReceiptTaskChain(tx, newReceipt.id);
      }

      return newReceipt;
    });

    // ✅ F4.3 — CAMINHO COM WMS: a entrada em estoque NÃO acontece aqui.
    // Ela é o efeito colateral de concluir a tarefa de ALOCACAO
    // (`completePutaway`), com `toPositionId` preenchido. `updateProductCosts`
    // também é adiado para lá — e não por gosto: o método lê `stock_balances`
    // e SUBTRAI `acceptedQty` para achar o saldo anterior ao recebimento
    // (correção da Fase 1, item 1.6). Ele só está correto DEPOIS de a entrada
    // ter sido registrada; chamá-lo aqui, no caminho com WMS, calcularia o
    // custo médio a partir de um "saldo anterior" negativo. O corpo do método
    // segue inalterado, como F4.5 exige — o que mudou é o momento em que a
    // pré-condição dele passa a valer.
    if (wmsEnabled) {
      await this.updateOrderStatus(data.purchaseOrderId);

      await eventBus.emit(SystemEvents.PURCHASE_ORDER_RECEIVED, {
        receiptId: receipt.id,
        receiptNumber: receipt.receiptNumber,
        purchaseOrderId: order.id,
        orderNumber: order.orderNumber,
        supplierId: order.supplierId,
        itemsCount: receipt.items.length,
      });

      console.log(
        `[PurchaseReceipt] Recebimento ${receipt.receiptNumber} registrado como CONFERIDO ` +
          `com cadeia de tarefas de armazém (WMS licenciado)`
      );

      return receipt;
    }

    // ✅ INTEGRAÇÃO: Registrar entrada de estoque para cada item
    for (const item of receipt.items) {
      try {
        await stockService.registerMovement({
          productId: item.productId,
          type: 'IN',
          quantity: item.acceptedQty,
          reason: `Recebimento de compra - Pedido ${order.orderNumber}`,
          reference: receipt.id,
          referenceType: 'PURCHASE',
          userId,
          notes: `Recebimento ${receipt.receiptNumber}${data.invoiceNumber ? `, NF: ${data.invoiceNumber}` : ''}`,
        });

        console.log(
          `[PurchaseReceipt] Entrada de estoque registrada: ` +
          `${item.acceptedQty} un. de ${item.product.code}`
        );
      } catch (error: any) {
        console.error(`[PurchaseReceipt] Erro ao registrar entrada de estoque:`, error.message);
        
        await eventBus.emit(SystemEvents.SYSTEM_ERROR, {
          type: 'STOCK_ENTRY_FAILED',
          receiptId: receipt.id,
          productId: item.productId,
          error: error.message,
        });
      }
    }

    // ✅ INTEGRAÇÃO: Atualizar custos dos produtos
    await this.updateProductCosts(receipt.items);

    // ✅ INTEGRAÇÃO: Atualizar status do pedido
    await this.updateOrderStatus(data.purchaseOrderId);

    // ✅ EVENT: Emitir evento de recebimento
    await eventBus.emit(SystemEvents.PURCHASE_ORDER_RECEIVED, {
      receiptId: receipt.id,
      receiptNumber: receipt.receiptNumber,
      purchaseOrderId: order.id,
      orderNumber: order.orderNumber,
      supplierId: order.supplierId,
      itemsCount: receipt.items.length,
    });

    console.log(`[PurchaseReceipt] Recebimento ${receipt.receiptNumber} registrado com sucesso`);

    return receipt;
  }

  /**
   * F4.4 + F4.5 — CONCLUSÃO DA TAREFA DE `ALOCACAO`: o momento em que o
   * material de um recebimento entra no saldo, já endereçado.
   *
   * DESENHO (a decisão que F4.5 deixou em aberto): a cadeia tem UMA tarefa de
   * `ALOCACAO` por recebimento, e este método pode ser chamado VÁRIAS vezes
   * para ela — uma por par (item conferido, endereço). É o que a realidade de
   * armazém pede: 100 unidades podem ir 60 para uma posição e 40 para outra, e
   * um recebimento de cinco itens não deveria virar cinco tarefas na fila do
   * operador quando o trabalho físico é "guardar este palete". A alternativa
   * (uma tarefa por posição de destino) exigiria saber os destinos ANTES de
   * alguém olhar o material — precisamente o que a tarefa existe para decidir.
   *
   * A tarefa fecha sozinha (`COMPLETED`) quando todo `acceptedQty` de todo item
   * do recebimento está coberto por `ReceiptPutaway`; nesse mesmo instante o
   * recebimento vai de `CONFERIDO` para `COMPLETED`.
   *
   * ATOMICIDADE E ORDEM DE LOCK — a parte crítica. Tudo abaixo roda numa
   * transação só, travando nesta ordem invariante:
   *
   *   1. `warehouse_tasks`         (FOR UPDATE, em `loadTaskForUpdate`)
   *   2. `purchase_receipt_items`  (FOR UPDATE, aqui)
   *   3. `stock_balances`          (dentro de `applyMovement`)
   *   4. `stock_position_balances` (idem, crescente por id)
   *
   * O lock 2 é o que torna a invariante de F4.4 (`SUM(putaway) <= acceptedQty`)
   * inviolável: sem ele, dois endereçamentos concorrentes do mesmo item leriam
   * a mesma soma parcial e ambos passariam na validação — o banco não tem como
   * expressar uma constraint de agregação. O lock 1, mais externo, serializa as
   * conclusões da mesma tarefa antes de qualquer leitura de saldo e impede que
   * duas chamadas simultâneas decidam, as duas, que o recebimento terminou.
   */
  async completePutaway(taskId: string, data: CompletePutawayDto, userId: string) {
    if (data.quantity <= 0) {
      throw new AppError(400, 'Quantidade a endereçar deve ser maior que zero');
    }

    const result = await prisma.$transaction(async (tx) => {
      // ---- LOCK 1: a tarefa -------------------------------------------------
      const task = await loadTaskForUpdate(tx, taskId);

      if (task.type !== WarehouseTaskType.ALOCACAO) {
        throw new AppError(
          400,
          `Tarefa de ${task.type} não endereça material — use POST /warehouse-tasks/:id/complete.`
        );
      }

      assertTaskIsOpen(task);
      await assertChainOrderResolved(tx, task);

      if (task.referenceType !== RECEIPT_TASK_REFERENCE_TYPE || !task.reference) {
        throw new AppError(400, 'Tarefa de alocação não está vinculada a um recebimento');
      }

      const receiptId = task.reference;

      // ---- LOCK 2: o item conferido ----------------------------------------
      // `FOR UPDATE` no ITEM (e não só a leitura via Prisma) porque é a soma dos
      // putaways DELE que precisa ser estável entre a validação e a escrita.
      const itemRows = await tx.$queryRaw<
        {
          id: string;
          receiptId: string;
          productId: string;
          acceptedQty: number;
          // Fase 5 — o que foi LIDO na etiqueta durante a conferência.
          lotNumber: string | null;
          manufacturedAt: Date | null;
          expiresAt: Date | null;
        }[]
      >`
        SELECT id, receiptId, productId, acceptedQty, lotNumber, manufacturedAt, expiresAt
        FROM purchase_receipt_items
        WHERE id = ${data.receiptItemId}
        FOR UPDATE
      `;

      if (itemRows.length === 0) {
        throw new AppError(404, 'Item de recebimento não encontrado');
      }

      const item = itemRows[0];

      if (item.receiptId !== receiptId) {
        throw new AppError(
          400,
          'Item de recebimento não pertence ao recebimento desta tarefa de alocação'
        );
      }

      // A posição existe? `applyMovement` também valida (404), mas a checagem de
      // BLOQUEIO mora aqui: `stock.service.ts` deliberadamente restringiu a dele
      // a `TRANSFER` e registrou que a recusa de `IN` em posição bloqueada é
      // decisão da Fase 4. É esta. Guardar material numa posição bloqueada
      // (avariada, interditada, em bloqueio de qualidade) é justamente o que a
      // flag existe para impedir.
      const position = await tx.storagePosition.findUnique({
        where: { id: data.storagePositionId },
        select: { id: true, code: true, blocked: true },
      });

      if (!position) {
        throw new AppError(404, 'Posição de armazenagem não encontrada');
      }

      if (position.blocked) {
        throw new AppError(
          400,
          `Posição ${position.code} está bloqueada e não pode receber material.`
        );
      }

      // Invariante de F4.4, com o item travado. Aritmética em `Decimal`: a
      // coluna é DECIMAL(18,4) (decisão D2) e somar em float reintroduziria o
      // arredondamento que ela existe para evitar.
      const aggregated = await tx.receiptPutaway.aggregate({
        where: { receiptItemId: item.id },
        _sum: { quantity: true },
      });

      const alreadyPutaway = new Prisma.Decimal(aggregated._sum.quantity ?? 0);
      const requested = new Prisma.Decimal(data.quantity);
      const accepted = new Prisma.Decimal(item.acceptedQty);

      if (alreadyPutaway.plus(requested).greaterThan(accepted)) {
        throw new AppError(
          400,
          `Quantidade endereçada excede a conferida. Aceito: ${accepted.toString()}, ` +
            `já endereçado: ${alreadyPutaway.toString()}, solicitado: ${requested.toString()}.`
        );
      }

      const putaway = await tx.receiptPutaway.create({
        data: {
          receiptItemId: item.id,
          storagePositionId: position.id,
          quantity: requested,
          userId,
          taskId: task.id,
        },
      });

      // ---- FASE 5: o `Lot` NASCE AQUI ---------------------------------------
      // Não na conferência: até a alocação acontecer, o que existe é uma
      // ETIQUETA LIDA na doca (`purchase_receipt_items.lotNumber`), não um lote
      // com saldo pendurado. Criar o `Lot` na conferência produziria lotes
      // órfãos para todo recebimento cancelado antes de ser endereçado.
      const lotId = await this.resolveLotForPutaway(tx, item, receiptId);

      // ---- LOCKS 3 e 4 + a movimentação, na MESMA transação -----------------
      // `registerMovementInTransaction` (já existente) em vez de
      // `registerMovement`: o `ReceiptPutaway` e a entrada de estoque são a
      // mesma verdade contada duas vezes — não podem existir um sem o outro.
      await stockService.registerMovementInTransaction(tx, {
        productId: item.productId,
        type: StockMovementType.IN,
        quantity: data.quantity,
        reason: 'Endereçamento de recebimento de compra',
        // `reference`/`referenceType` iguais aos do caminho sem WMS de propósito:
        // é o mesmo par que `cancel()` e os relatórios de compra já procuram.
        reference: receiptId,
        referenceType: 'PURCHASE',
        userId,
        notes: `Alocação em ${position.code} (tarefa ${task.id})`,
        toPositionId: position.id,
        // Fase 5 — a entrada de estoque carrega o lote, e é isto que faz a
        // terceira dimensão do saldo existir: a linha de
        // `stock_position_balances` criada/atualizada é a de (produto, posição,
        // lote). `undefined` (não `null`) para produto sem lote — é o valor que
        // `StockMovementDto.lotId?` espera para "não informado".
        lotId: lotId ?? undefined,
      });

      // O recebimento inteiro está endereçado?
      const receiptItems = await tx.purchaseReceiptItem.findMany({
        where: { receiptId },
        select: { id: true, acceptedQty: true },
      });

      const sums = await tx.receiptPutaway.groupBy({
        by: ['receiptItemId'],
        where: { receiptItemId: { in: receiptItems.map((i) => i.id) } },
        _sum: { quantity: true },
      });

      const putawayByItem = new Map(
        sums.map((s) => [s.receiptItemId, new Prisma.Decimal(s._sum.quantity ?? 0)])
      );

      const fullyPutaway = receiptItems.every((receiptItem) => {
        const total = putawayByItem.get(receiptItem.id) ?? new Prisma.Decimal(0);
        return total.greaterThanOrEqualTo(new Prisma.Decimal(receiptItem.acceptedQty));
      });

      if (fullyPutaway) {
        await markTaskCompleted(tx, task);
        await tx.purchaseReceipt.update({
          where: { id: receiptId },
          data: { status: 'COMPLETED' },
        });
      } else {
        // Endereçamento parcial: a tarefa passa a IN_PROGRESS na primeira
        // chamada e só fecha quando o último item for coberto.
        await markTaskStarted(tx, task);
      }

      return { putaway, receiptId, fullyPutaway };
    });

    // ✅ INTEGRAÇÃO: custo médio, FORA da transação e só quando o recebimento
    // fecha — mesmo ponto lógico do caminho sem WMS (todas as entradas deste
    // recebimento já registradas, `stock_balances` já refletindo todas elas).
    // O método em si segue inalterado (F4.5).
    if (result.fullyPutaway) {
      const items = await prisma.purchaseReceiptItem.findMany({
        where: { receiptId: result.receiptId },
        include: { product: true, orderItem: true },
      });

      await this.updateProductCosts(items);

      console.log(
        `[PurchaseReceipt] Recebimento ${result.receiptId} totalmente endereçado — status COMPLETED`
      );
    }

    return {
      putaway: {
        ...result.putaway,
        // Decisão D2: quantidade `Decimal` é serializada como STRING nos
        // endpoints novos, igual aos da Fase 1.
        quantity: result.putaway.quantity.toString(),
      },
      receiptCompleted: result.fullyPutaway,
    };
  }

  /**
   * ✅ FASE 5 — resolve (criando na primeira vez) o `Lot` de um item de
   * recebimento sendo endereçado. Devolve `null` quando não há lote a rastrear.
   *
   * QUANDO DEVOLVE `null`, e os dois casos são diferentes:
   *   * produto sem `lotTracked` — o caminho de sempre, sem uma linha de
   *     comportamento nova;
   *   * produto `lotTracked` cujo item NÃO tem `lotNumber`. Só acontece quando a
   *     flag foi LIGADA depois da conferência: o recebimento foi conferido
   *     quando o produto ainda não era rastreado, e o número do lote é uma
   *     informação que ninguém leu e que este método não tem como inventar.
   *     Recusar o endereçamento deixaria o material preso na doca para sempre;
   *     endereçá-lo sem lote produz exatamente o "estoque legado sem lote" que
   *     `planPickingFromPositions` já sabe consumir por último. Endereçar é o
   *     mal menor, e a lacuna é visível (linha de saldo com `lotId` nulo).
   *
   * IDENTIDADE DO LOTE: `(productId, lotNumber)`, o unique do schema. O mesmo
   * lote do mesmo produto chegando em dois recebimentos é UM lote — é o ponto
   * inteiro da rastreabilidade, e criar duas linhas partiria o saldo e o recall
   * em dois.
   *
   * DATAS: quem cria manda. Um segundo recebimento do MESMO lote não
   * SOBRESCREVE `manufacturedAt`/`expiresAt`/`supplierId` já gravados —
   * reescrever a validade de material que já está no estoque a partir de uma
   * digitação posterior é como um lote vencido "desvence" por engano. O que ele
   * faz é PREENCHER o que estava nulo, que é ganho de informação sem perda.
   *
   * CONCORRÊNCIA: dois endereçamentos de recebimentos DIFERENTES do mesmo lote
   * podem chegar juntos aqui (o lock 1 serializa a mesma TAREFA, não o mesmo
   * lote). O unique `(productId, lotNumber)` é quem decide: o perdedor da
   * corrida toma P2002 e relê a linha que o vencedor criou. Em MySQL um
   * statement que falha não aborta a transação, então a releitura é válida e o
   * endereçamento segue normalmente.
   */
  private async resolveLotForPutaway(
    tx: Prisma.TransactionClient,
    item: {
      productId: string;
      lotNumber: string | null;
      manufacturedAt: Date | null;
      expiresAt: Date | null;
    },
    receiptId: string
  ): Promise<string | null> {
    if (!item.lotNumber) {
      return null;
    }

    const product = await tx.product.findUnique({
      where: { id: item.productId },
      select: { lotTracked: true },
    });

    if (!product?.lotTracked) {
      return null;
    }

    const lotNumber = item.lotNumber.trim();

    const existing = await tx.lot.findUnique({
      where: { productId_lotNumber: { productId: item.productId, lotNumber } },
      select: { id: true, manufacturedAt: true, expiresAt: true, supplierId: true },
    });

    // O fornecedor do lote é o do PEDIDO por trás do recebimento — o lote nasce
    // de uma compra neste caminho. Lote de produção própria ou de ajuste nasce
    // sem fornecedor (a coluna é nullable justamente por isso).
    const receipt = await tx.purchaseReceipt.findUnique({
      where: { id: receiptId },
      select: { order: { select: { supplierId: true } } },
    });
    const supplierId = receipt?.order?.supplierId ?? null;

    if (existing) {
      const fill: Prisma.LotUpdateInput = {};
      if (existing.manufacturedAt === null && item.manufacturedAt) {
        fill.manufacturedAt = item.manufacturedAt;
      }
      if (existing.expiresAt === null && item.expiresAt) {
        fill.expiresAt = item.expiresAt;
      }
      if (existing.supplierId === null && supplierId) {
        fill.supplier = { connect: { id: supplierId } };
      }

      if (Object.keys(fill).length > 0) {
        await tx.lot.update({ where: { id: existing.id }, data: fill });
      }

      return existing.id;
    }

    try {
      const created = await tx.lot.create({
        data: {
          productId: item.productId,
          lotNumber,
          manufacturedAt: item.manufacturedAt,
          expiresAt: item.expiresAt,
          supplierId,
        },
        select: { id: true },
      });

      return created.id;
    } catch (error: any) {
      if (error?.code !== 'P2002') {
        throw error;
      }

      // Perdeu a corrida: o lote existe agora, criado por outra transação.
      const raced = await tx.lot.findUniqueOrThrow({
        where: { productId_lotNumber: { productId: item.productId, lotNumber } },
        select: { id: true },
      });

      return raced.id;
    }
  }

  /**
   * Atualiza custos dos produtos baseado no recebimento
   *
   * ✅ CORREÇÃO (Fase 1, item 1.6 do cronograma):
   * 1) Atomicidade: lia `product.averageCost` e escrevia de volta fora de
   *    qualquer transação/lock - dois recebimentos concorrentes do mesmo
   *    produto podiam calcular o custo médio a partir do mesmo valor
   *    desatualizado (lost update). Agora cada produto é travado
   *    (`SELECT ... FOR UPDATE`) dentro de uma transação por item.
   * 2) Cálculo: usava `prisma.stockMovement.findMany` somando TODO o
   *    histórico (o padrão O(n) que stock.service.ts já não usa mais desde
   *    a Fase 1.1/1.2) e, pior, isso já incluía a própria entrada de
   *    estoque deste recebimento (registrada no loop logo antes, em
   *    `create()`) - somava `item.quantityReceived` DUAS vezes no estoque
   *    usado para ponderar o custo médio. Agora lê o saldo persistido
   *    (`stock_balances`, já atualizado por essa entrada) e subtrai a
   *    quantidade deste item para achar o saldo anterior ao recebimento.
   */
  private async updateProductCosts(items: any[]) {
    for (const item of items) {
      await prisma.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<{ averageCost: number | null }[]>`
          SELECT averageCost FROM products WHERE id = ${item.productId} FOR UPDATE
        `;
        if (locked.length === 0) return;

        const balance = await tx.stockBalance.findUnique({ where: { productId: item.productId } });
        // stock_balances já reflete a entrada deste recebimento (registrada antes, em create())
        const postReceiptStock = balance?.quantity ?? item.acceptedQty;
        const preReceiptStock = postReceiptStock - item.acceptedQty;

        // Calcular novo custo médio ponderado
        const currentValue = (locked[0].averageCost || 0) * preReceiptStock;
        const newValue = currentValue + (item.orderItem.unitPrice * item.acceptedQty);
        const newAverageCost = postReceiptStock > 0 ? newValue / postReceiptStock : item.orderItem.unitPrice;

        await tx.product.update({
          where: { id: item.productId },
          data: {
            lastCost: item.orderItem.unitPrice,
            averageCost: newAverageCost,
          },
        });

        console.log(
          `[PurchaseReceipt] Custo atualizado para ${item.product.code}: ` +
          `Estoque: ${preReceiptStock} → ${postReceiptStock}, ` +
          `Último: R$ ${item.orderItem.unitPrice.toFixed(2)}, ` +
          `Médio: R$ ${newAverageCost.toFixed(2)}`
        );
      });
    }
  }

  /**
   * Atualiza status do pedido baseado nos recebimentos
   */
  private async updateOrderStatus(orderId: string) {
    const order = await prisma.purchaseOrder.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) return;

    // Verificar se todos os itens foram recebidos
    const allReceived = order.items.every(item => item.receivedQty >= item.quantity);
    const someReceived = order.items.some(item => item.receivedQty > 0);

    let newStatus = order.status;

    if (allReceived) {
      newStatus = 'RECEIVED';
    } else if (someReceived) {
      newStatus = 'PARTIAL';
    } else if (order.status === 'PARTIAL' || order.status === 'RECEIVED') {
      // ✅ Achado ao testar o cancel() corrigido (Fase 1, item 1.6): esta
      // função só avançava o status (PARTIAL/RECEIVED), nunca revertia -
      // cancelar todos os recebimentos de um pedido deixava o status
      // "RECEIVED" para sempre, mesmo com receivedQty voltando a 0.
      newStatus = 'CONFIRMED';
    }

    if (newStatus !== order.status) {
      await prisma.purchaseOrder.update({
        where: { id: orderId },
        data: { status: newStatus },
      });

      console.log(`[PurchaseReceipt] Status do pedido ${order.orderNumber} atualizado para ${newStatus}`);
    }
  }

  /**
   * Lista recebimentos
   */
  async getAll(filters?: {
    purchaseOrderId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const where: any = {};

    if (filters?.purchaseOrderId) {
      where.orderId = filters.purchaseOrderId;
    }

    if (filters?.startDate || filters?.endDate) {
      where.receiptDate = {};
      if (filters.startDate) {
        where.receiptDate.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.receiptDate.lte = new Date(filters.endDate);
      }
    }

    return prisma.purchaseReceipt.findMany({
      where,
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            supplier: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { receiptDate: 'desc' },
    });
  }

  /**
   * Busca recebimento por ID
   */
  async getById(id: string) {
    const receipt = await prisma.purchaseReceipt.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
            orderItem: true,
          },
        },
        order: {
          include: {
            supplier: true,
            items: true,
          },
        },
      },
    });

    if (!receipt) {
      throw new AppError(404, 'Recebimento não encontrado');
    }

    return receipt;
  }

  /**
   * Cancela recebimento (estorna estoque)
   *
   * ✅ CORREÇÃO ATOMICIDADE (Fase 1, item 1.6 do cronograma): antes, o
   * estorno de estoque (um `registerMovement` por item, cada um em sua
   * própria transação) rodava inteiramente FORA da transação que atualiza
   * `purchaseOrderItem.receivedQty` e apaga o recebimento. Se a segunda
   * parte falhasse (ou o processo caísse no meio), o estoque já tinha sido
   * estornado sem o recebimento ser removido - estado inconsistente.
   * Agora tudo roda em uma única transação, usando
   * `stockService.registerMovementInTransaction` para reaproveitar o `tx`.
   *
   * ✅ F4.3/F4.5 — o cancelamento também tem dois caminhos, e o critério NÃO é
   * a licença atual: é a EXISTÊNCIA DE TAREFAS no recebimento. Um recebimento
   * criado enquanto o WMS estava licenciado precisa ser cancelado do jeito WMS
   * mesmo que a licença tenha sido desligada depois; ler `isModuleEnabled`
   * aqui estornaria estoque que nunca entrou.
   *
   *   Sem tarefas (recebimento linear) → estorna `acceptedQty` de cada item,
   *     sem posição. Idêntico ao que sempre foi.
   *   Com tarefas → estorna EXATAMENTE o que foi endereçado (um `OUT` por
   *     `ReceiptPutaway`, com `fromPositionId`), e nada mais. Um recebimento
   *     ainda em `CONFERIDO`, sem nenhum endereçamento, não gera movimentação
   *     nenhuma — não havia estoque para estornar. Estornar `acceptedQty` como
   *     no caminho linear derrubaria o saldo do produto para negativo (ou
   *     falharia com "estoque insuficiente"), que é o bug que este branch
   *     evita.
   */
  async cancel(id: string, userId: string, reason: string) {
    const receipt = await this.getById(id);

    const taskCount = await prisma.warehouseTask.count({
      where: { referenceType: RECEIPT_TASK_REFERENCE_TYPE, reference: receipt.id },
    });
    const isTaskDriven = taskCount > 0;

    await prisma.$transaction(async (tx) => {
      if (isTaskDriven) {
        const putaways = await tx.receiptPutaway.findMany({
          where: { receiptItemId: { in: receipt.items.map((item) => item.id) } },
          include: { storagePosition: { select: { code: true } } },
        });

        const productByItem = new Map(receipt.items.map((item) => [item.id, item.productId]));

        // ✅ FASE 5 — o estorno tem de devolver o MESMO lote que entrou.
        //
        // Não é cosmético: a entrada criou a linha de saldo (produto, posição,
        // LOTE), e um `OUT` sem `lotId` procuraria a linha SEM lote daquele
        // endereço — que não existe — e falharia com "estoque insuficiente na
        // posição". O lote é reencontrado por `(productId, lotNumber)`, o mesmo
        // par que `resolveLotForPutaway` usou para criá-lo.
        //
        // CONSEQUÊNCIA CONHECIDA E ACEITA: cancelar um recebimento cujo lote JÁ
        // VENCEU é recusado, porque o estorno é um `OUT` e `applyMovement`
        // bloqueia saída de lote vencido. O caminho para tirar material vencido
        // do saldo é o ajuste (`ADJUSTMENT`), que é a exceção deliberada da
        // regra — e é também a operação que descreve honestamente o que
        // aconteceu (o material venceu no armazém; não "nunca foi recebido").
        const lotIdByItem = new Map<string, string>();
        const lotTrackedItems = receipt.items.filter((item) => item.lotNumber);

        for (const item of lotTrackedItems) {
          const lot = await tx.lot.findUnique({
            where: {
              productId_lotNumber: {
                productId: item.productId,
                lotNumber: item.lotNumber!,
              },
            },
            select: { id: true },
          });

          if (lot) {
            lotIdByItem.set(item.id, lot.id);
          }
        }

        for (const putaway of putaways) {
          await stockService.registerMovementInTransaction(tx, {
            productId: productByItem.get(putaway.receiptItemId)!,
            lotId: lotIdByItem.get(putaway.receiptItemId),
            type: StockMovementType.OUT,
            quantity: Number(putaway.quantity),
            reason: `Estorno de recebimento - ${reason}`,
            reference: receipt.id,
            referenceType: 'PURCHASE',
            userId,
            notes:
              `Cancelamento do recebimento ${receipt.receiptNumber} - ` +
              `estorno do endereçamento em ${putaway.storagePosition.code}`,
            fromPositionId: putaway.storagePositionId,
          });
        }

        // A trilha de endereçamento e as tarefas saem junto com o recebimento.
        // Ordem obrigatória: as FKs são RESTRICT (ver o comentário no schema),
        // então putaway → tarefa → recebimento, nunca o contrário.
        await tx.receiptPutaway.deleteMany({
          where: { receiptItemId: { in: receipt.items.map((item) => item.id) } },
        });
        await deleteTasksForReceipt(tx, receipt.id);
      }

      for (const item of receipt.items) {
        if (!isTaskDriven) {
          await stockService.registerMovementInTransaction(tx, {
            productId: item.productId,
            type: 'OUT',
            quantity: item.acceptedQty,
            reason: `Estorno de recebimento - ${reason}`,
            reference: receipt.id,
            referenceType: 'PURCHASE',
            userId,
            notes: `Cancelamento do recebimento ${receipt.receiptNumber}`,
          });
        }

        const orderItem = await tx.purchaseOrderItem.findUnique({
          where: { id: item.orderItemId },
        });

        if (orderItem) {
          await tx.purchaseOrderItem.update({
            where: { id: item.orderItemId },
            data: {
              receivedQty: Math.max(0, orderItem.receivedQty - item.acceptedQty),
            },
          });
        }
      }

      // Deletar recebimento
      await tx.purchaseReceipt.delete({
        where: { id },
      });
    });

    // Atualizar status do pedido (fora da transação - leitura derivada, não crítica)
    await this.updateOrderStatus(receipt.orderId);

    console.log(`[PurchaseReceipt] Recebimento ${receipt.receiptNumber} cancelado`);
  }
}

export default new PurchaseReceiptService();
