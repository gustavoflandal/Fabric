import { Prisma, StockMovementType } from '@prisma/client';
import { prisma } from '../config/database';
import { eventBus, SystemEvents } from '../events/event-bus';
import notificationDetector from './notification-detector.service';
import { AppError } from '../middleware/error.middleware';
import { AGGREGATE_MOVEMENT_TYPES } from '../utils/stock-movement.util';
import { isModuleEnabled } from './licensed-module.service';
import { createPickingTasks } from './warehouse-task.service';

type TransactionClient = Prisma.TransactionClient;

/**
 * F2.2 do plano do WMS: o tipo da movimentação deixou de ser um literal string
 * declarado à mão em cada arquivo e passou a ser o enum `StockMovementType`
 * gerado pelo Prisma a partir do schema — uma única fonte de verdade, alinhada
 * com a constraint do banco. Reexportado daqui porque este é o service dono do
 * conceito; quem precisar do tipo importa dele, não do `@prisma/client`.
 */
export { StockMovementType };

/**
 * F2.2 — reexportado por conveniência de quem já importa deste service. A
 * definição mora em `utils/stock-movement.util.ts` para não fechar ciclo de
 * módulos com `notification-detector.service.ts` (ver a nota lá).
 */
export { AGGREGATE_MOVEMENT_TYPES };

export interface StockMovementDto {
  productId: string;
  type: StockMovementType;
  quantity: number;
  reason: string;
  reference?: string;
  referenceType?: 'PRODUCTION' | 'PURCHASE' | 'ADJUSTMENT' | 'MANUAL' | 'COUNTING';
  countingSessionId?: string;
  userId: string;
  notes?: string;
  /**
   * F2.1 do plano do WMS — o par ORIGEM/DESTINO que substituiu o campo único
   * `positionId` da Fase 1 (a migration reaproveitou os valores existentes).
   *
   * Semântica, validada em `assertPositionsMatchType()`:
   *   IN         → só `toPositionId`   (onde a quantidade ENTROU)
   *   OUT        → só `fromPositionId` (de onde a quantidade SAIU)
   *   TRANSFER   → os DOIS, obrigatórios e diferentes entre si
   *   ADJUSTMENT → UM dos dois (`to` = sobra encontrada, `from` = quebra)
   *
   * Omitir os dois (o caso de 100% dos chamadores de produção: recebimento,
   * contagem, reserva de produção, entrada/saída manual) mantém o comportamento
   * exatamente como antes da Fase 1 — só o saldo agregado é mexido. Isso é
   * esperado até as fases 3 e 4 conectarem esses fluxos ao endereço.
   */
  fromPositionId?: string;
  toPositionId?: string;
}

/**
 * F2.3 — entrada de `transfer()`. Não é um `StockMovementDto` com `type`
 * fixado: `type`, `referenceType` e a obrigatoriedade das duas posições são
 * decisões do próprio método, não do chamador.
 */
export interface StockTransferDto {
  productId: string;
  fromPositionId: string;
  toPositionId: string;
  quantity: number;
  reason: string;
  userId: string;
  reference?: string;
  notes?: string;
}

/**
 * F2.1 — uma perna do efeito de uma movimentação sobre `stock_position_balances`.
 * `IN`/`OUT`/`ADJUSTMENT` endereçados geram uma; `TRANSFER` gera duas (débito na
 * origem, crédito no destino).
 */
interface PositionDelta {
  positionId: string;
  delta: Prisma.Decimal;
}

/**
 * F2.4 — projeção do endereço embutida no histórico de movimentação. Enxuta de
 * propósito: o consumidor precisa identificar e exibir o endereço (`code` é o
 * que está na etiqueta), não do registro inteiro da posição.
 */
const MOVEMENT_POSITION_SELECT = {
  id: true,
  code: true,
  warehouseCode: true,
  streetCode: true,
  floor: true,
  position: true,
} as const;

export interface StockBalance {
  productId: string;
  product: any;
  quantity: number;
  minStock: number;
  maxStock: number;
  safetyStock: number;
  status: 'OK' | 'LOW' | 'CRITICAL' | 'EXCESS';
  lastMovement?: Date;
}

export class StockServiceRefactored {
  /**
   * Lê o saldo travando a linha (SELECT ... FOR UPDATE dentro da transação),
   * cria a movimentação e atualiza o saldo - tudo atômico e serializado por
   * produto. Compartilhado por registerMovement (própria transação) e por
   * reserveForOrder (transação do chamador), por isso recebe o `tx`.
   *
   * ✅ CORREÇÃO RACE CONDITION (Fase 1, itens 1.1/1.2 do cronograma):
   * antes, o saldo era somado em memória a partir de stock_movements a cada
   * chamada - não existia linha para travar, então duas movimentações
   * concorrentes do mesmo produto podiam ler o mesmo saldo "fantasma" e
   * ambas decidirem que havia estoque suficiente.
   */
  /**
   * Versão pública de applyMovement para chamadores externos que já têm uma
   * transação própria e precisam que a movimentação de estoque seja
   * atômica junto com outras escritas (ex: purchase-receipt.service.ts::
   * cancel(), onde o estorno de estoque e a exclusão do recebimento
   * precisam ser tudo ou nada).
   */
  async registerMovementInTransaction(tx: TransactionClient, data: StockMovementDto) {
    return this.applyMovement(tx, data);
  }

  /**
   * F2.1 — coerência entre `type` e o par origem/destino.
   *
   * Sem esta guarda o service aceitaria combinações que o banco não tem como
   * recusar (as duas colunas são nullable) e que produziriam saldo errado em
   * silêncio: um `TRANSFER` com só uma ponta debitaria a origem sem creditar
   * ninguém; um `IN` com `fromPositionId` sugeriria uma origem que a
   * movimentação nunca debitou.
   *
   * Lançado como `AppError` (400), não `Error`: é erro de USO da API, e o
   * middleware de erro precisa traduzi-lo em 400, não em 500.
   */
  private assertPositionsMatchType(data: StockMovementDto): void {
    const { type, fromPositionId, toPositionId } = data;

    switch (type) {
      case StockMovementType.IN:
        if (fromPositionId) {
          throw new AppError(
            400,
            'Movimentação de entrada (IN) não pode ter posição de origem — ' +
              'informe apenas toPositionId.'
          );
        }
        break;

      case StockMovementType.OUT:
        if (toPositionId) {
          throw new AppError(
            400,
            'Movimentação de saída (OUT) não pode ter posição de destino — ' +
              'informe apenas fromPositionId.'
          );
        }
        break;

      case StockMovementType.TRANSFER:
        if (!fromPositionId || !toPositionId) {
          throw new AppError(
            400,
            'Transferência exige posição de origem (fromPositionId) e de ' +
              'destino (toPositionId).'
          );
        }
        if (fromPositionId === toPositionId) {
          throw new AppError(
            400,
            'Posição de origem e destino são a mesma — nada a transferir.'
          );
        }
        break;

      case StockMovementType.ADJUSTMENT:
        if (fromPositionId && toPositionId) {
          throw new AppError(
            400,
            'Ajuste endereça UMA posição: informe fromPositionId (quebra) ou ' +
              'toPositionId (sobra), não os dois.'
          );
        }
        break;
    }
  }

  /**
   * F2.1 — traduz `type` + par de posições no efeito sobre
   * `stock_position_balances`, já ORDENADO pelo id da posição (ver a nota de
   * ordem determinística em `applyMovement`).
   *
   * Devolve lista vazia para movimentação não endereçada, que é o caminho de
   * 100% dos chamadores legados.
   */
  private buildPositionDeltas(data: StockMovementDto): PositionDelta[] {
    const quantity = new Prisma.Decimal(data.quantity);
    const deltas: PositionDelta[] = [];

    // Origem sempre DEBITA, destino sempre CREDITA — independente do tipo.
    // É essa simetria que faz TRANSFER (as duas pernas) cair no mesmo caminho
    // de código que IN e OUT (uma perna só), em vez de num ramo paralelo.
    if (data.fromPositionId) {
      deltas.push({ positionId: data.fromPositionId, delta: quantity.negated() });
    }
    if (data.toPositionId) {
      deltas.push({ positionId: data.toPositionId, delta: quantity });
    }

    return deltas.sort((a, b) => (a.positionId < b.positionId ? -1 : 1));
  }

  /**
   * F1.2 / F2.1 do plano do WMS — ORDEM DETERMINÍSTICA DE LOCK.
   *
   * Quando a movimentação informa posição, ATÉ TRÊS linhas são travadas na
   * mesma transação: `stock_balances` (agregado do produto) e uma ou duas de
   * `stock_position_balances` (produto × posição — duas no caso de
   * `TRANSFER`). Se uma transação travasse A→B e outra B→A, elas se
   * bloqueariam mutuamente — deadlock.
   *
   * A ordem escolhida e INVARIANTE tem dois níveis:
   *
   *   1) **`stock_balances` PRIMEIRO, sempre.** O agregado é o lock mais grosso
   *      e o único sempre presente — toda movimentação o trava, endereçada ou
   *      não, INCLUSIVE `TRANSFER` (que o trava sem alterá-lo, ver abaixo).
   *      Adotá-lo como lock externo significa que qualquer transação que vá
   *      mexer numa posição do produto X já está serializada pelo lock de X
   *      antes de tocar em qualquer linha de posição. Fosse o contrário, uma
   *      movimentação sem posição (que só trava o agregado) poderia entrar no
   *      meio de uma endereçada e inverter a ordem.
   *
   *   2) **`stock_position_balances` depois, em ordem CRESCENTE de
   *      `storagePositionId`** (`buildPositionDeltas` já devolve ordenado).
   *      Sem essa segunda regra, duas transferências concorrentes A→B e B→A
   *      travariam as duas mesmas linhas em ordem oposta e poderiam
   *      deadlockar. Ordenando, ambas pegam A antes de B e a segunda
   *      simplesmente espera.
   *
   * `TRANSFER` é o único tipo que **não altera o saldo agregado**: transferir
   * não muda quanto o produto tem, só onde está. Ele ainda assim adquire o
   * lock do agregado (nível 1 acima) — o lock é sobre a ORDEM, não sobre a
   * escrita —, mas a linha de `stock_balances` não é atualizada, nem tem
   * `version` incrementada: bumpar a versão sinalizaria a um leitor com lock
   * otimista uma mudança que não houve.
   *
   * Regra prática para quem mexer aqui: nunca trave uma linha de
   * `stock_position_balances` sem já segurar o lock do `stock_balances` do
   * mesmo produto, e nunca trave duas posições fora da ordem crescente de id.
   */
  private async applyMovement(tx: TransactionClient, data: StockMovementDto) {
    this.assertPositionsMatchType(data);

    // ---- LOCK 1 (externo): saldo agregado do produto -----------------------
    await tx.stockBalance.upsert({
      where: { productId: data.productId },
      create: { productId: data.productId, quantity: 0 },
      update: {},
    });

    const locked = await tx.$queryRaw<{ quantity: number }[]>`
      SELECT quantity FROM stock_balances WHERE productId = ${data.productId} FOR UPDATE
    `;
    const currentQty = Number(locked[0]?.quantity ?? 0);

    // TRANSFER: delta ZERO no agregado (só muda de endereço). OUT: negativo.
    // IN/ADJUSTMENT: positivo.
    const delta =
      data.type === StockMovementType.TRANSFER
        ? 0
        : data.type === StockMovementType.OUT
          ? -data.quantity
          : data.quantity;

    if (data.type === StockMovementType.OUT && currentQty < data.quantity) {
      throw new AppError(
        400,
        `Estoque insuficiente. Disponível: ${currentQty}, Solicitado: ${data.quantity}`
      );
    }

    // ---- LOCK 2 (interno): saldo das posições, na ordem crescente de id ----
    // Sem posição nenhuma este bloco não roda e o comportamento é byte-a-byte
    // o de antes da Fase 1 (compatibilidade — nenhum chamador legado passa
    // posição).
    const positionDeltas = this.buildPositionDeltas(data);
    const newPositionQuantities = new Map<string, Prisma.Decimal>();

    if (positionDeltas.length > 0) {
      const positions = await tx.storagePosition.findMany({
        where: { id: { in: positionDeltas.map((d) => d.positionId) } },
        select: { id: true, code: true, blocked: true },
      });
      const positionById = new Map(positions.map((p) => [p.id, p]));

      for (const { positionId } of positionDeltas) {
        if (!positionById.has(positionId)) {
          throw new AppError(404, 'Posição de armazenagem não encontrada');
        }
      }

      // F2.3 — o DESTINO de uma transferência não pode estar bloqueado.
      // A checagem mora aqui, DENTRO da transação, e não só no validator: uma
      // posição pode ser bloqueada entre a validação da borda e a escrita, e
      // este é o único ponto que enxerga o estado sob lock. Escopo deliberado
      // em TRANSFER: um `IN` de recebimento em posição bloqueada é decisão da
      // Fase 4 (regra de endereçamento, F4.6), não desta.
      if (data.type === StockMovementType.TRANSFER && data.toPositionId) {
        const destination = positionById.get(data.toPositionId)!;
        if (destination.blocked) {
          throw new AppError(
            400,
            `Posição de destino ${destination.code} está bloqueada e não pode receber material.`
          );
        }
      }

      for (const { positionId, delta: positionDelta } of positionDeltas) {
        const position = positionById.get(positionId)!;

        await tx.stockPositionBalance.upsert({
          where: {
            productId_storagePositionId: {
              productId: data.productId,
              storagePositionId: positionId,
            },
          },
          create: {
            productId: data.productId,
            storagePositionId: positionId,
            quantity: 0,
          },
          update: {},
        });

        const lockedPosition = await tx.$queryRaw<{ quantity: Prisma.Decimal }[]>`
          SELECT quantity FROM stock_position_balances
          WHERE productId = ${data.productId} AND storagePositionId = ${positionId}
          FOR UPDATE
        `;

        // Aritmética em Decimal, não em Number: a coluna é DECIMAL(18,4)
        // (decisão D2) e converter para float aqui reintroduziria justamente o
        // erro de arredondamento que o Decimal existe para evitar.
        const currentPositionQty = new Prisma.Decimal(lockedPosition[0]?.quantity ?? 0);
        const newQty = currentPositionQty.plus(positionDelta);

        // Validação de saldo NA POSIÇÃO, além da do agregado: ter 100 no
        // produto não autoriza tirar 100 de um endereço que só tem 3. Vale
        // para toda perna de DÉBITO — a saída de um OUT e a origem de um
        // TRANSFER —, e é checada com o lock da linha já na mão, então o valor
        // lido não pode mudar antes da escrita.
        if (newQty.isNegative()) {
          throw new AppError(
            400,
            `Estoque insuficiente na posição ${position.code}. ` +
              `Disponível: ${currentPositionQty.toString()}, Solicitado: ${data.quantity}`
          );
        }

        newPositionQuantities.set(positionId, newQty);
      }
    }

    const movement = await tx.stockMovement.create({
      data: {
        productId: data.productId,
        type: data.type,
        quantity: data.quantity,
        reason: data.reason,
        reference: data.reference,
        referenceType: data.referenceType,
        countingSessionId: data.countingSessionId,
        userId: data.userId,
        notes: data.notes,
        fromPositionId: data.fromPositionId,
        toPositionId: data.toPositionId,
      },
      include: {
        product: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // `delta === 0` só acontece em TRANSFER: nem escrita nem `version` no
    // agregado, porque nada nele mudou (ver a nota do cabeçalho).
    if (delta !== 0) {
      await tx.stockBalance.update({
        where: { productId: data.productId },
        data: { quantity: currentQty + delta, version: { increment: 1 } },
      });
    }

    for (const [positionId, quantity] of newPositionQuantities) {
      await tx.stockPositionBalance.update({
        where: {
          productId_storagePositionId: {
            productId: data.productId,
            storagePositionId: positionId,
          },
        },
        data: { quantity, version: { increment: 1 } },
      });
    }

    return movement;
  }

  /**
   * Registra uma movimentação de estoque
   */
  async registerMovement(data: StockMovementDto) {
    // Validar produto
    const product = await prisma.product.findUnique({
      where: { id: data.productId },
    });

    if (!product) {
      throw new AppError(404, 'Produto não encontrado');
    }

    // Validar quantidade
    if (data.quantity <= 0) {
      throw new AppError(400, 'Quantidade deve ser maior que zero');
    }

    const movement = await prisma.$transaction((tx) => this.applyMovement(tx, data));

    // Emitir evento
    await eventBus.emit(SystemEvents.STOCK_MOVEMENT_CREATED, {
      movementId: movement.id,
      productId: movement.productId,
      type: movement.type,
      quantity: movement.quantity,
      reference: movement.reference,
    });

    // Verificar níveis de estoque
    await this.checkStockLevels(data.productId);

    // ✅ NOTIFICAÇÃO: Verificar estoque baixo após movimentação
    const currentBalance = await this.getBalance(data.productId);
    if (currentBalance.quantity <= product.minStock) {
      notificationDetector.checkLowStock().catch(err => {
        console.error('Erro ao verificar estoque baixo:', err);
      });
    }

    return movement;
  }

  /**
   * Obtém saldo REAL de estoque de um produto (lido da tabela de saldo
   * persistida, não mais recalculado somando o histórico inteiro)
   */
  async getBalance(productId: string): Promise<StockBalance> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: true,
        unit: true,
      },
    });

    if (!product) {
      throw new AppError(404, 'Produto não encontrado');
    }

    let balanceRow = await prisma.stockBalance.findUnique({ where: { productId } });
    if (!balanceRow) {
      balanceRow = await prisma.stockBalance.upsert({
        where: { productId },
        create: { productId, quantity: 0 },
        update: {},
      });
    }

    const lastMovementRow = await prisma.stockMovement.findFirst({
      where: { productId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    const quantity = balanceRow.quantity;
    const lastMovement = lastMovementRow?.createdAt;

    return this.toBalance(product, quantity, lastMovement);
  }

  /**
   * Monta o DTO de saldo (limiares + status derivado) a partir do produto e da
   * quantidade já lida. Extraído de getBalance() para ser o ponto único da
   * regra de status, compartilhado com getAllBalances() — que passou a ler
   * produto, saldo e última movimentação em lote (ver F0.5 abaixo) e não pode
   * chamar getBalance() por produto.
   */
  private toBalance(product: any, quantity: number, lastMovement?: Date): StockBalance {
    const minStock = product.minStock || 0;
    const maxStock = product.maxStock || 1000;
    const safetyStock = product.safetyStock || 0;

    // Determinar status
    let status: 'OK' | 'LOW' | 'CRITICAL' | 'EXCESS' = 'OK';

    if (quantity < safetyStock) {
      status = 'CRITICAL';
    } else if (quantity < minStock) {
      status = 'LOW';
    } else if (quantity > maxStock) {
      status = 'EXCESS';
    }

    return {
      productId: product.id,
      product,
      quantity,
      minStock,
      maxStock,
      safetyStock,
      status,
      lastMovement,
    };
  }

  /**
   * Lista todos os saldos de estoque
   *
   * ✅ F0.5 do plano do WMS (docs/fase-2026-09-modernizacao/WMS_IMPLEMENTATION_ANALYSIS.md):
   * antes este método iterava os produtos ativos chamando `getBalance()` um a
   * um — 3 queries por produto (produto + saldo + última movimentação), ou seja
   * N+1 clássico, e o produto ainda era buscado duas vezes (aqui e lá dentro).
   * Com uma base de milhares de SKUs isso já é lento; com saldo POR POSIÇÃO
   * (Fase 1) o mesmo padrão viraria N×M queries. Agora são 2 queries fixas,
   * independentemente do número de produtos:
   *   1) produtos + categoria + unidade + saldo (join via include);
   *   2) MAX(createdAt) das movimentações agrupado por produto.
   *
   * O contrato de retorno é idêntico ao anterior (mesmo shape de StockBalance,
   * mesma regra de status via `toBalance`), para não quebrar
   * getSummary/getStockConsolidation/getLowStockProducts/getExcessStockProducts
   * nem os consumidores de `GET /stock/balances`.
   *
   * Única diferença de comportamento, deliberada: este caminho de LEITURA não
   * cria mais linha de `stock_balances` para produto que ainda não tem saldo —
   * produto sem linha é lido como quantidade 0. Quem cria a linha é o caminho
   * de escrita (`applyMovement`, dentro da transação com lock) e `getBalance()`.
   */
  async getAllBalances(filters?: {
    status?: 'OK' | 'LOW' | 'CRITICAL' | 'EXCESS';
    type?: string;
    categoryId?: string;
  }): Promise<StockBalance[]> {
    const where: any = { active: true };

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.categoryId) {
      where.categoryId = filters.categoryId;
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        category: true,
        unit: true,
        stockBalance: true,
      },
    });

    if (products.length === 0) {
      return [];
    }

    const lastMovements = await prisma.stockMovement.groupBy({
      by: ['productId'],
      where: { productId: { in: products.map((p) => p.id) } },
      _max: { createdAt: true },
    });

    const lastMovementByProduct = new Map(
      lastMovements.map((m) => [m.productId, m._max.createdAt ?? undefined])
    );

    const balances: StockBalance[] = [];

    for (const product of products) {
      // `stockBalance` é detalhe da consulta, não faz parte do contrato de
      // `product` que os consumidores já recebiam - removido do objeto exposto.
      const { stockBalance, ...productData } = product;

      const balance = this.toBalance(
        productData,
        stockBalance?.quantity ?? 0,
        lastMovementByProduct.get(product.id)
      );

      // Filtrar por status se especificado
      if (filters?.status && balance.status !== filters.status) {
        continue;
      }

      balances.push(balance);
    }

    return balances;
  }

  /**
   * Obtém histórico de movimentações de um produto.
   *
   * F2.4 — ganhou o filtro `positionId`: "o que aconteceu com ESTE produto
   * NESTE endereço". Uma posição pode ter sido origem OU destino da
   * movimentação (e, num `TRANSFER` interno à mesma posição, nunca as duas —
   * `assertPositionsMatchType` recusa origem igual a destino), então o filtro é
   * um OR sobre as duas colunas, atendido pelos índices de
   * `fromPositionId`/`toPositionId`.
   */
  async getMovementHistory(
    productId: string,
    filters?: {
      type?: StockMovementType;
      positionId?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    }
  ) {
    const where: any = { productId };

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.positionId) {
      where.OR = [
        { fromPositionId: filters.positionId },
        { toPositionId: filters.positionId },
      ];
    }

    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.createdAt.lte = filters.endDate;
      }
    }

    const movements = await prisma.stockMovement.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        // F2.4 — o endereço é o dado que torna o histórico rastreável ("de onde
        // veio, para onde foi"). `code` é o que o operador lê na etiqueta; sem
        // ele a resposta traria só um UUID e o consumidor precisaria de uma
        // segunda chamada por linha.
        fromPosition: { select: MOVEMENT_POSITION_SELECT },
        toPosition: { select: MOVEMENT_POSITION_SELECT },
      },
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 100,
    });

    return movements;
  }

  /**
   * F2.3 — TRANSFERÊNCIA INTERNA entre dois endereços.
   *
   * Uma ÚNICA movimentação `TRANSFER` que debita a origem e credita o destino
   * na mesma transação — e não um par OUT/IN, que poderia ficar órfão pela
   * metade e apareceria no histórico como se o material tivesse saído do
   * armazém e voltado.
   *
   * O saldo agregado (`stock_balances`) NÃO é tocado: transferir não muda
   * quanto o produto tem, só onde está. Consequências deliberadas, diferentes
   * de `registerMovement()`:
   *   * `checkStockLevels()` não é chamado — os limiares (mín./máx./segurança)
   *     são do agregado, que não mudou; disparar os eventos aqui geraria
   *     alerta repetido a cada transferência sem nenhum fato novo.
   *   * a notificação de estoque baixo, pelo mesmo motivo, não é disparada.
   *   * `STOCK_MOVEMENT_CREATED` É emitido: rastreabilidade é justamente o
   *     ponto desta fase, e o listener só registra o fato.
   *
   * As validações de coerência (as duas pontas presentes, diferentes entre si,
   * posições existentes, destino não bloqueado, saldo suficiente NA ORIGEM)
   * moram em `applyMovement()`, dentro da transação e com os locks na mão —
   * checá-las aqui fora seria TOCTOU.
   */
  async transfer(data: StockTransferDto) {
    const product = await prisma.product.findUnique({
      where: { id: data.productId },
    });

    if (!product) {
      throw new AppError(404, 'Produto não encontrado');
    }

    if (data.quantity <= 0) {
      throw new AppError(400, 'Quantidade deve ser maior que zero');
    }

    const movement = await prisma.$transaction((tx) =>
      this.applyMovement(tx, {
        productId: data.productId,
        type: StockMovementType.TRANSFER,
        quantity: data.quantity,
        reason: data.reason,
        reference: data.reference,
        // Transferência é operação interna de armazém, não produção/compra/
        // contagem — `MANUAL` é o valor existente que a descreve.
        referenceType: 'MANUAL',
        userId: data.userId,
        notes: data.notes,
        fromPositionId: data.fromPositionId,
        toPositionId: data.toPositionId,
      })
    );

    await eventBus.emit(SystemEvents.STOCK_MOVEMENT_CREATED, {
      movementId: movement.id,
      productId: movement.productId,
      type: movement.type,
      quantity: movement.quantity,
      reference: movement.reference,
    });

    return movement;
  }

  /**
   * Verifica níveis de estoque e emite alertas
   */
  private async checkStockLevels(productId: string): Promise<void> {
    const balance = await this.getBalance(productId);

    if (balance.status === 'CRITICAL') {
      await eventBus.emit(SystemEvents.STOCK_LEVEL_CRITICAL, {
        productId: balance.productId,
        productCode: balance.product.code,
        productName: balance.product.name,
        currentQty: balance.quantity,
        safetyStock: balance.safetyStock,
        minStock: balance.minStock,
      });
    } else if (balance.status === 'LOW') {
      await eventBus.emit(SystemEvents.STOCK_LEVEL_LOW, {
        productId: balance.productId,
        productCode: balance.product.code,
        productName: balance.product.name,
        currentQty: balance.quantity,
        minStock: balance.minStock,
      });
    } else if (balance.status === 'EXCESS') {
      await eventBus.emit(SystemEvents.STOCK_LEVEL_EXCESS, {
        productId: balance.productId,
        productCode: balance.product.code,
        productName: balance.product.name,
        currentQty: balance.quantity,
        maxStock: balance.maxStock,
      });
    }
  }

  /**
   * Ajuste manual de estoque
   */
  async adjustStock(
    productId: string,
    newQuantity: number,
    reason: string,
    userId: string,
    notes?: string
  ) {
    const currentBalance = await this.getBalance(productId);
    const difference = newQuantity - currentBalance.quantity;

    if (difference === 0) {
      throw new AppError(400, 'Nova quantidade é igual à quantidade atual');
    }

    const type = difference > 0 ? 'IN' : 'OUT';
    const quantity = Math.abs(difference);

    return this.registerMovement({
      productId,
      type,
      quantity,
      reason: `Ajuste: ${reason}`,
      referenceType: 'ADJUSTMENT',
      userId,
      notes: `Quantidade anterior: ${currentBalance.quantity}, Nova quantidade: ${newQuantity}. ${notes || ''}`,
    });
  }

  /**
   * Consolidação de estoque (para relatórios)
   */
  async getStockConsolidation(filters?: {
    categoryId?: string;
    type?: string;
    status?: 'OK' | 'LOW' | 'CRITICAL' | 'EXCESS';
  }) {
    const balances = await this.getAllBalances(filters);

    const consolidation = {
      totalProducts: balances.length,
      totalValue: 0,
      byStatus: {
        OK: 0,
        LOW: 0,
        CRITICAL: 0,
        EXCESS: 0,
      },
      byCategory: {} as Record<string, number>,
      products: balances,
    };

    for (const balance of balances) {
      // Contar por status
      consolidation.byStatus[balance.status]++;

      // Calcular valor total
      const cost = balance.product.averageCost || balance.product.lastCost || 0;
      consolidation.totalValue += balance.quantity * cost;

      // Agrupar por categoria
      const categoryName = balance.product.category?.name || 'Sem Categoria';
      if (!consolidation.byCategory[categoryName]) {
        consolidation.byCategory[categoryName] = 0;
      }
      consolidation.byCategory[categoryName]++;
    }

    return consolidation;
  }

  /**
   * Obtém resumo do estoque
   */
  async getSummary() {
    const balances = await this.getAllBalances();
    
    const total = balances.length;
    const ok = balances.filter(b => b.status === 'OK').length;
    const low = balances.filter(b => b.status === 'LOW').length;
    const critical = balances.filter(b => b.status === 'CRITICAL').length;
    const excess = balances.filter(b => b.status === 'EXCESS').length;
    
    const totalValue = balances.reduce((sum, b) => {
      const cost = b.product.averageCost || b.product.lastCost || b.product.standardCost || 0;
      return sum + (b.quantity * cost);
    }, 0);

    return {
      total,
      ok,
      low,
      critical,
      excess,
      totalValue,
      lastUpdate: new Date(),
    };
  }

  /**
   * Obtém produtos com estoque baixo
   */
  async getLowStockProducts(): Promise<StockBalance[]> {
    const balances = await this.getAllBalances();
    return balances.filter(b => b.status === 'LOW' || b.status === 'CRITICAL');
  }

  /**
   * Obtém produtos com estoque em excesso
   */
  async getExcessStockProducts(): Promise<StockBalance[]> {
    const balances = await this.getAllBalances();
    return balances.filter(b => b.status === 'EXCESS');
  }

  /**
   * Obtém movimentações de um produto.
   *
   * F2.4 — `positionId` é opcional e recorta o histórico do produto a um
   * endereço. Assinatura posicional mantida (`limit` continua sendo o 2º
   * argumento) para não quebrar os chamadores existentes.
   */
  async getMovements(productId: string, limit = 50, positionId?: string) {
    return this.getMovementHistory(productId, { limit, positionId });
  }

  /**
   * Registra entrada de estoque
   */
  async registerEntry(data: {
    productId: string;
    quantity: number;
    reason: string;
    reference?: string;
    userId: string;
    notes?: string;
  }) {
    return this.registerMovement({
      productId: data.productId,
      type: 'IN',
      quantity: data.quantity,
      reason: data.reason,
      reference: data.reference,
      referenceType: 'MANUAL',
      userId: data.userId,
      notes: data.notes,
    });
  }

  /**
   * Registra saída de estoque
   */
  async registerExit(data: {
    productId: string;
    quantity: number;
    reason: string;
    reference?: string;
    userId: string;
    notes?: string;
  }) {
    return this.registerMovement({
      productId: data.productId,
      type: 'OUT',
      quantity: data.quantity,
      reason: data.reason,
      reference: data.reference,
      referenceType: 'MANUAL',
      userId: data.userId,
      notes: data.notes,
    });
  }

  /**
   * Registra ajuste de estoque
   */
  async registerAdjustment(data: {
    productId: string;
    quantity: number;
    reason: string;
    userId: string;
    notes?: string;
  }) {
    const currentBalance = await this.getBalance(data.productId);
    const difference = data.quantity - currentBalance.quantity;

    if (difference === 0) {
      throw new AppError(400, 'Nova quantidade é igual à quantidade atual');
    }

    const type = difference > 0 ? 'IN' : 'OUT';
    const quantity = Math.abs(difference);

    return this.registerMovement({
      productId: data.productId,
      type,
      quantity,
      reason: `Ajuste: ${data.reason}`,
      referenceType: 'ADJUSTMENT',
      userId: data.userId,
      notes: `Quantidade anterior: ${currentBalance.quantity}, Nova quantidade: ${data.quantity}. ${data.notes || ''}`,
    });
  }

  /**
   * F4.8 do plano do WMS — ESCOLHA DA POSIÇÃO DE SAÍDA POR FIFO.
   *
   * Devolve, para um componente, DE QUAIS ENDEREÇOS tirar a quantidade pedida.
   *
   * CRITÉRIO DE ANTIGUIDADE: `StockPositionBalance.updatedAt` ASC — a linha de
   * saldo cujo último movimento é o mais antigo sai primeiro. É o que o item do
   * plano pede e, mais importante, é o melhor sinal de idade que EXISTE no dado
   * de hoje. As alternativas foram consideradas e são piores:
   *
   *   * `StockMovement` mais antigo com `toPositionId = X` seria a data de
   *     ENTRADA naquele endereço — mais próximo do FIFO ideal, mas exige varrer
   *     o histórico por posição a cada reserva (o padrão O(n) que a Fase 1
   *     eliminou) e mesmo assim erra quando a posição recebeu duas entradas em
   *     datas diferentes: não há como saber qual unidade sai.
   *   * FEFO (por validade) é o critério certo para quem tem lote/validade —
   *     e é exatamente por isso que a Decisão D6 do plano deixou lote/validade
   *     para uma fase condicional posterior. Sem `StockLot`, não há data de
   *     validade para ordenar. O GANCHO para ela é este método: quando
   *     `StockLot` existir, é aqui que o `orderBy` muda, e nada mais no fluxo
   *     de picking precisa saber.
   *
   * A honestidade sobre a limitação está registrada de propósito: `updatedAt`
   * muda a cada movimento na posição, então uma posição que recebeu material
   * novo "rejuvenesce". É um FIFO POR ENDEREÇO, não por unidade — que é o que
   * um WMS sem controle de lote consegue prometer.
   *
   * DESEMPATE por `id` ASC: duas linhas de saldo com o mesmo `updatedAt`
   * (perfeitamente possível — duas posições atualizadas na mesma transação)
   * precisam sair sempre na mesma ordem, senão duas chamadas idênticas geram
   * planos de separação diferentes.
   */
  private async planPickingFromPositions(
    tx: TransactionClient,
    productId: string,
    productCode: string,
    requiredQty: number
  ) {
    const required = new Prisma.Decimal(requiredQty);

    const balances = await tx.stockPositionBalance.findMany({
      where: {
        productId,
        quantity: { gt: 0 },
        // Posição bloqueada não fornece material: `blocked` é interdição
        // física (avaria, bloqueio de qualidade), e mandar o operador tirar
        // material de lá é exatamente o que a flag existe para impedir.
        storagePosition: { blocked: false },
      },
      select: { storagePositionId: true, quantity: true },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
    });

    const allocations: {
      productId: string;
      storagePositionId: string;
      quantity: Prisma.Decimal;
    }[] = [];
    let remaining = required;

    for (const balance of balances) {
      if (remaining.lessThanOrEqualTo(0)) break;

      const take = Prisma.Decimal.min(remaining, balance.quantity);
      allocations.push({
        productId,
        storagePositionId: balance.storagePositionId,
        quantity: take,
      });
      remaining = remaining.minus(take);
    }

    if (remaining.greaterThan(0)) {
      // Este erro é ESPECÍFICO do modo WMS e não existe no modo sem WMS, onde
      // só o saldo agregado importa. Ele aparece quando há saldo do produto mas
      // ele NÃO ESTÁ ENDEREÇADO — o estado normal de uma instalação que
      // acabou de licenciar o WMS e ainda não endereçou o estoque legado (a
      // diferença que o job de reconciliação da Fase 1 já reporta como
      // legítima). A mensagem diz o que fazer, não só que falhou.
      const addressed = required.minus(remaining);
      throw new AppError(
        400,
        `Saldo endereçado insuficiente para ${productCode}: necessário ` +
          `${required.toString()}, endereçado ${addressed.toString()}. ` +
          'Enderece o material antes de separar (o saldo existe, mas não está em nenhuma posição).'
      );
    }

    return allocations;
  }

  /**
   * Reserva estoque para uma ordem de produção
   * ✅ CORREÇÃO RACE CONDITION: Usa transação para garantir atomicidade
   *
   * ✅ F4.8 do plano do WMS — este método tem DOIS comportamentos, decididos por
   * um único branch (`isModuleEnabled('WMS')`), exatamente como
   * `purchase-receipt.service.ts::create()` faz na entrada. É a mesma disciplina
   * da Fase 4a aplicada à SAÍDA:
   *
   *   SEM WMS licenciado → INALTERADO. Valida o saldo agregado de todos os
   *     componentes (fail-fast, com lock) e registra as saídas `OUT` sem
   *     posição. Nenhuma linha deste caminho mudou.
   *
   *   COM WMS licenciado → nenhum saldo é debitado. Para cada componente da
   *     BOM, o FIFO escolhe DE ONDE tirar (`planPickingFromPositions`) e a
   *     reserva gera tarefas de `PICKING` com `fromPositionId` já definido. O
   *     débito acontece quando o operador conclui a tarefa
   *     (`warehouse-task-execution.service.ts`), com `applyMovement` tipo `OUT`
   *     + `fromPositionId`, na transação da conclusão.
   *
   * POR QUE NÃO DEBITAR NA CRIAÇÃO DA TAREFA — é o mesmo argumento de F4.3, do
   * outro lado do fluxo: o material continua fisicamente na posição até alguém
   * ir lá tirá-lo. Um saldo que já debitou é um saldo que a próxima contagem
   * cíclica desmente, e a divergência recai sobre o endereço, que é justamente o
   * dado que o WMS existe para tornar confiável.
   *
   * SOBRE-ALOCAÇÃO CONCORRENTE (limitação conhecida e deliberada): duas ordens
   * reservadas ao mesmo tempo podem planejar picking da MESMA posição, porque a
   * criação de tarefa não trava saldo de posição — ela não o altera. As duas
   * tarefas nascem; a primeira CONCLUSÃO debita e a segunda falha com "estoque
   * insuficiente na posição", sob o lock de `applyMovement`. Travar as posições
   * já na reserva seria segurar lock de saldo pelo tempo de vida de um plano de
   * separação (minutos ou horas até o operador executar) — trocaria uma
   * exceção rara e recuperável por contenção garantida no armazém inteiro.
   * O saldo NUNCA fica negativo em nenhum dos casos; o que pode acontecer é uma
   * tarefa precisar ser replanejada, que é uma decisão de armazém, não um bug de
   * consistência.
   */
  async reserveForOrder(orderId: string, userId: string) {
    // F4.8 — O BRANCH. Lido uma vez, ANTES da transação, mesmo padrão de
    // `purchase-receipt.service.ts::create()`: `isModuleEnabled` bate num cache
    // em memória carregado no boot, então não é uma query a mais dentro da
    // transação.
    const wmsEnabled = await isModuleEnabled('WMS');

    return await prisma.$transaction(async (tx) => {
      const order = await tx.productionOrder.findUnique({
        where: { id: orderId },
        include: {
          product: true,
        },
      });

      if (!order) {
        throw new AppError(404, 'Ordem de produção não encontrada');
      }

      // Buscar BOM ativa do produto
      const activeBom = await tx.bOM.findFirst({
        where: {
          productId: order.productId,
          active: true,
        },
        include: {
          items: {
            include: {
              component: true,
            },
          },
        },
      });

      if (!activeBom) {
        throw new AppError(404, 'BOM ativa não encontrada para o produto');
      }

      // ✅ FASE 1: Validar TODOS os estoques antes de reservar qualquer um (fail-fast).
      // Trava cada linha de saldo aqui mesmo (a mesma transação/conexão reutiliza o
      // lock em FASE 2) para que nenhuma outra reserva concorrente consiga ler um
      // saldo desatualizado entre a validação e a escrita.
      const requiredItems = activeBom.items.map(bomItem => ({
        componentId: bomItem.componentId,
        componentCode: bomItem.component.code,
        requiredQty: bomItem.quantity * order.quantity * (1 + bomItem.scrapFactor),
      }));

      for (const item of requiredItems) {
        await tx.stockBalance.upsert({
          where: { productId: item.componentId },
          create: { productId: item.componentId, quantity: 0 },
          update: {},
        });

        const locked = await tx.$queryRaw<{ quantity: number }[]>`
          SELECT quantity FROM stock_balances WHERE productId = ${item.componentId} FOR UPDATE
        `;
        const balance = Number(locked[0]?.quantity ?? 0);

        if (balance < item.requiredQty) {
          throw new AppError(400, `Estoque insuficiente para ${item.componentCode}: disponível ${balance}, necessário ${item.requiredQty}`);
        }
      }

      // ✅ F4.8 — CAMINHO COM WMS: nenhum débito aqui. A FASE 1 acima continua
      // valendo e é útil nos dois modos (não adianta planejar separação de
      // material que o produto inteiro não tem); o que muda é o que se faz
      // depois de validar.
      if (wmsEnabled) {
        const allocations: {
          productId: string;
          storagePositionId: string;
          quantity: Prisma.Decimal;
        }[] = [];

        for (const item of requiredItems) {
          const planned = await this.planPickingFromPositions(
            tx,
            item.componentId,
            item.componentCode,
            item.requiredQty
          );
          allocations.push(...planned);
        }

        // As tarefas nascem na MESMA transação do planejamento: uma reserva que
        // "deu certo" sem tarefa nenhuma seria uma ordem que ninguém consegue
        // separar — mesmo raciocínio da cadeia de recebimento em F4.3.
        await createPickingTasks(tx, order.id, allocations);

        return {
          orderId: order.id,
          orderNumber: order.orderNumber,
          // `mode` explícito para o cliente não ter de inferir o modo pela
          // ausência de `reservations` — o frontend precisa mostrar telas
          // diferentes ("material reservado" vs. "separação gerada").
          mode: 'WMS_PICKING' as const,
          reservations: [] as unknown[],
          pickingTasks: allocations.map((allocation) => ({
            productId: allocation.productId,
            storagePositionId: allocation.storagePositionId,
            // Decisão D2: quantidade `Decimal` sai como STRING nos contratos
            // novos, igual ao resto do WMS.
            quantity: allocation.quantity.toString(),
          })),
          totalItems: allocations.length,
        };
      }

      // ✅ FASE 2: Todos os estoques validados e travados, agora registrar TODAS as saídas
      const reservations = [];

      for (const item of requiredItems) {
        const movement = await this.applyMovement(tx, {
          productId: item.componentId,
          type: 'OUT',
          quantity: item.requiredQty,
          reason: 'Reserva para produção',
          reference: order.orderNumber,
          referenceType: 'MANUAL',
          userId,
        });

        reservations.push(movement);
      }

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        mode: 'DIRECT' as const,
        reservations,
        totalItems: reservations.length,
      };
    });
  }
}

export default new StockServiceRefactored();
