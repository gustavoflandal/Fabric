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
  /**
   * Fase 5 do plano do WMS — o LOTE movimentado.
   *
   * Campo ÚNICO, e não um par `from`/`to` como as posições: a quantidade que
   * muda de saldo é sempre do MESMO lote, inclusive num `TRANSFER` (mudar de
   * endereço não reetiqueta o material). Ver a nota no schema.
   *
   * Só é preenchido para produto com `lotTracked = true` — `applyMovement()`
   * recusa (400) um `lotId` de produto que não controla lote, e recusa um lote
   * que não pertence ao produto da movimentação. Omitir mantém o comportamento
   * byte-a-byte o de antes desta fase, que é o caminho de todo produto sem
   * lote controlado e de todo chamador legado.
   */
  lotId?: string;
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
  /**
   * Fase 5 — o lote transferido. Um `TRANSFER` não reetiqueta material, então é
   * um campo só (o mesmo lote nas duas pontas), e ele é o que identifica a LINHA
   * de saldo em cada uma delas.
   *
   * Obrigatório na prática para produto `lotTracked`: sem lote, a origem
   * procuraria a linha SEM lote do endereço, que não existe para material
   * rastreado, e a transferência falharia com "estoque insuficiente na posição".
   * Não é validado como obrigatório aqui de propósito — a exigência depende de
   * uma flag do banco, e antecipá-la neste ponto duplicaria a regra que
   * `applyMovement` já aplica com o lock na mão.
   */
  lotId?: string;
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
   * Fase 5 — o lote da movimentação, validado.
   *
   * Devolve `null` quando a movimentação não informa lote (produto sem
   * `lotTracked`, ou qualquer chamador legado), e nesse caso NADA do
   * comportamento de lote roda.
   *
   * Duas guardas que o banco não expressa:
   *   1. o lote tem de pertencer AO PRODUTO da movimentação — a FK só garante
   *      que o lote existe, não que é deste produto, e um lote trocado gravaria
   *      saldo numa terceira dimensão errada, silenciosamente;
   *   2. o produto tem de ter `lotTracked` — aceitar lote em produto que não
   *      controla lote criaria linhas de saldo com lote convivendo com linhas
   *      sem lote no mesmo endereço, que é justamente a inconsistência que a
   *      flag existe para evitar.
   */
  private async loadMovementLot(tx: TransactionClient, data: StockMovementDto) {
    if (!data.lotId) {
      return null;
    }

    const lot = await tx.lot.findUnique({
      where: { id: data.lotId },
      select: {
        id: true,
        lotNumber: true,
        productId: true,
        expiresAt: true,
        product: { select: { lotTracked: true } },
      },
    });

    if (!lot) {
      throw new AppError(404, 'Lote não encontrado');
    }

    if (lot.productId !== data.productId) {
      throw new AppError(400, `Lote ${lot.lotNumber} não pertence ao produto informado.`);
    }

    if (!lot.product.lotTracked) {
      throw new AppError(
        400,
        `Produto do lote ${lot.lotNumber} não tem controle de lote habilitado.`
      );
    }

    return lot;
  }

  /**
   * Fase 5 — BLOQUEIO DE SAÍDA DE LOTE VENCIDO, com a exceção que o torna
   * utilizável.
   *
   * REGRA: nenhuma movimentação que REDUZA o saldo de um lote pode sair depois
   * de `expiresAt`. Isso cobre `OUT` (inclusive a conclusão de uma tarefa de
   * `PICKING`, que é um `OUT` com `fromPositionId`) e `TRANSFER` (que sempre
   * debita a origem). Vencimento é DERIVADO da data no instante da operação —
   * não existe campo de status de lote, de propósito (ver o schema).
   *
   * ⚠️ A EXCEÇÃO — O AJUSTE PASSA, E ISSO É DELIBERADO. NÃO "CORRIJA".
   * Bloquear TODA saída de lote vencido tornaria impossível dar baixa no
   * estoque vencido pelo caminho normal do sistema: o material continuaria
   * eternamente no saldo, porque a única operação capaz de removê-lo estaria
   * proibida. O ajuste é exatamente o que o Fabric já usa para correção e baixa
   * (quebra, descarte, correção pós-contagem), e precisa continuar podendo
   * remover um lote vencido do saldo. Quem revisar isto sem o contexto vai achar
   * que é um furo na regra; é o contrário — é o que permite que a regra exista
   * sem prender estoque morto no armazém.
   *
   * ⚠️ COMO "AJUSTE" É RECONHECIDO — e este detalhe é o que faz a exceção
   * FUNCIONAR em vez de ser letra morta. Um ajuste no Fabric NÃO é
   * `type = ADJUSTMENT`: é `type = OUT` (ou `IN`) com
   * `referenceType = 'ADJUSTMENT'`. É assim em `registerAdjustment()`,
   * `adjustStock()` e no ajuste pós-contagem de F3.4 — e por um motivo real:
   * `applyMovement` calcula o delta do saldo agregado pelo TIPO, e
   * `type = ADJUSTMENT` sempre soma (ver o cálculo de `delta`), então um ajuste
   * de BAIXA gravado como `ADJUSTMENT` aumentaria o saldo. `StockMovementType`
   * ADJUSTMENT existe no enum e é aceito aqui por completude, mas nenhum
   * chamador o usa. Testar a exceção só contra o TIPO passaria — e a baixa de
   * lote vencido continuaria impossível na prática.
   *
   * `referenceType = 'COUNTING'` NÃO é exceção, e não precisa ser: a contagem
   * não ganhou dimensão de lote nesta fase (fora de escopo declarado), então
   * todo ajuste pós-contagem chega aqui com `lot = null` e sai na primeira
   * linha. A consequência — contagem de produto `lotTracked` mira a linha de
   * saldo SEM lote do endereço — está registrada no plano, não é acidente.
   *
   * Consequência conhecida e aceita: `TRANSFER` de lote vencido é recusado,
   * então mover material vencido para uma área de bloqueio/descarte não se faz
   * por transferência — faz-se pela baixa (`OUT` com `referenceType`
   * `'ADJUSTMENT'`), que é a operação que descreve o que de fato aconteceu com
   * ele.
   */
  private assertLotNotExpiredForOutbound(
    data: StockMovementDto,
    lot: { lotNumber: string; expiresAt: Date | null } | null
  ): void {
    if (!lot || !lot.expiresAt) {
      return;
    }

    // Ver os dois blocos ⚠️ acima antes de mexer nestas duas linhas.
    if (
      data.type === StockMovementType.ADJUSTMENT ||
      data.referenceType === 'ADJUSTMENT'
    ) {
      return;
    }

    const reducesLotBalance =
      data.type === StockMovementType.OUT || data.type === StockMovementType.TRANSFER;

    if (!reducesLotBalance) {
      return;
    }

    if (lot.expiresAt.getTime() < Date.now()) {
      throw new AppError(
        400,
        `Lote ${lot.lotNumber} venceu em ${lot.expiresAt.toISOString().slice(0, 10)} e não ` +
          'pode sair do estoque. Use um ajuste de baixa para retirar o material vencido.'
      );
    }
  }

  /**
   * Fase 5 — resolve (criando se preciso) a linha de `stock_position_balances`
   * da chave composta (produto, posição, lote) e devolve o `id` dela.
   *
   * POR QUE NÃO É MAIS UM `upsert` PELA CHAVE ÚNICA, como era até a Fase 4: o
   * Prisma gera o input de chave única composta com TODAS as colunas
   * não-nulas, mesmo quando uma delas é opcional no schema — não há como passar
   * `lotId: null` por ali. A busca então é feita em SQL, com o operador
   * null-safe do MySQL (`<=>`), que trata `NULL <=> NULL` como igual e é
   * exatamente a semântica de "a linha SEM lote desta posição".
   *
   * SEGURANÇA DA CRIAÇÃO — o ponto delicado, e o motivo do `FOR UPDATE` na
   * busca. São DUAS proteções distintas, e cada uma cobre o que a outra não
   * cobre:
   *
   *   1. LOCK 1 (`stock_balances` do produto, adquirido no início de
   *      `applyMovement`) SERIALIZA as escritas de saldo daquele produto. É ele
   *      que substitui a garantia que o banco deixou de dar sozinho: como o
   *      índice único trata NULL como distinto, nada impede o InnoDB de aceitar
   *      duas linhas SEM lote para o mesmo (produto, posição).
   *
   *   2. `FOR UPDATE` nesta busca torna a leitura CONSISTENTE COM O PRESENTE.
   *      Serializar não basta — e isto foi encontrado por teste, não por
   *      inspeção. Em REPEATABLE READ (o default do InnoDB) o snapshot da
   *      transação nasce na PRIMEIRA leitura não-travante dela, que aqui é o
   *      `upsert` de `stock_balances` — ANTES de LOCK 1 ser concedido. A
   *      transação que esperou pelo lock enxergaria, num `SELECT` comum, um
   *      mundo em que a linha criada pela vencedora ainda não existe, e
   *      tentaria criá-la de novo: com lote, estoura no índice único; SEM lote,
   *      seria pior — o índice não recusa, e a posição ficaria com duas linhas
   *      do mesmo produto, cada uma com metade do saldo. Leitura travante lê a
   *      versão mais recente commitada, não o snapshot, e é isso que fecha a
   *      janela.
   *
   * O `FOR UPDATE` também já deixa a linha travada para o `SELECT quantity`
   * seguinte em `applyMovement` — é a MESMA linha, na mesma ordem, não um lock
   * a mais (ver a nota de ordem determinística lá).
   */
  private async resolvePositionBalanceRow(
    tx: TransactionClient,
    productId: string,
    storagePositionId: string,
    lotId: string | null
  ): Promise<string> {
    const existing = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM stock_position_balances
      WHERE productId = ${productId}
        AND storagePositionId = ${storagePositionId}
        AND lotId <=> ${lotId}
      LIMIT 1
      FOR UPDATE
    `;

    if (existing.length > 0) {
      return existing[0].id;
    }

    const created = await tx.stockPositionBalance.create({
      data: { productId, storagePositionId, lotId, quantity: 0 },
      select: { id: true },
    });

    return created.id;
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
   *
   * FASE 5 — O LOTE NÃO ACRESCENTA UMA PERNA DE LOCK. Quando `data.lotId` vem
   * preenchido, ele apenas ESTREITA a linha de `stock_position_balances` a ser
   * travada: a chave passa de (produto, posição) para (produto, posição, lote),
   * mas continua sendo UMA linha por perna de movimentação. Nada muda na ordem
   * entre `stock_balances` e `stock_position_balances`, nem na ordem crescente
   * por `storagePositionId` entre as duas pernas de um `TRANSFER` — o lote é
   * mais uma coluna da mesma linha, não um recurso a mais para disputar.
   * (E, como o índice único trata NULL como distinto, é justamente o LOCK 1 que
   * garante unicidade da linha sem lote — ver `resolvePositionBalanceRow`.)
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

    // ---- FASE 5: lote (validação + regra de vencimento) --------------------
    // Depois do LOCK 1 de propósito: são leituras de `lots`/`products`, que não
    // participam da ordem de lock de saldo, e falhar aqui já com o lock na mão
    // custa uma transação abortada — nunca uma inconsistência.
    const lot = await this.loadMovementLot(tx, data);
    this.assertLotNotExpiredForOutbound(data, lot);
    const lotId = lot?.id ?? null;

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
    // Fase 5: a chave do mapa passou a ser o `id` da LINHA de saldo (que já
    // encapsula produto + posição + lote), e não mais o id da posição — numa
    // mesma posição podem conviver várias linhas, uma por lote.
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

        // Fase 5 — a linha é resolvida pela chave (produto, posição, LOTE).
        // Sem lote, `lotId` é `null` e o `<=>` lá dentro encontra exatamente a
        // mesma linha única que o `upsert` por chave composta encontrava antes.
        const balanceRowId = await this.resolvePositionBalanceRow(
          tx,
          data.productId,
          positionId,
          lotId
        );

        const lockedPosition = await tx.$queryRaw<{ quantity: Prisma.Decimal }[]>`
          SELECT quantity FROM stock_position_balances
          WHERE id = ${balanceRowId}
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
            `Estoque insuficiente na posição ${position.code}` +
              // Sem lote a mensagem é idêntica à de sempre; com lote, dizer só a
              // posição seria enganoso — o operador olharia o endereço, veria
              // material e não entenderia a recusa.
              (lot ? ` (lote ${lot.lotNumber})` : '') +
              `. Disponível: ${currentPositionQty.toString()}, Solicitado: ${data.quantity}`
          );
        }

        newPositionQuantities.set(balanceRowId, newQty);
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
        lotId,
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

    // `updateMany` e não `update`, apesar de o `where` ser a chave primária —
    // e a diferença NÃO é estilística.
    //
    // No MySQL o Prisma implementa `update` como SELECT-então-UPDATE, e esse
    // SELECT é uma leitura NÃO-TRAVANTE: em REPEATABLE READ ele enxerga o
    // snapshot da transação, aberto na primeira leitura dela (o `upsert` de
    // `stock_balances`, antes de LOCK 1 ser concedido). Uma transação que
    // esperou pelo lock e vai atualizar uma linha CRIADA nesse meio-tempo pela
    // vencedora falha com "Record to update not found" — a linha existe, está
    // travada por esta mesma transação, e ainda assim o snapshot não a vê.
    // `updateMany` emite um `UPDATE ... WHERE` direto, e escrita sempre opera
    // sobre a versão mais recente commitada.
    //
    // O mesmo cuidado do `FOR UPDATE` em `resolvePositionBalanceRow`, do outro
    // lado da mesma janela; os dois foram encontrados pelo teste de duas
    // entradas concorrentes criando a mesma linha de saldo.
    for (const [balanceRowId, quantity] of newPositionQuantities) {
      await tx.stockPositionBalance.updateMany({
        where: { id: balanceRowId },
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
        lotId: data.lotId,
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
   *     para uma fase condicional posterior. O gancho previsto era este método,
   *     e a Fase 5 é quem o usou (ver abaixo).
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
   *
   * ────────────────────────────────────────────────────────────────────────
   * FASE 5 — FEFO PARA PRODUTO COM `lotTracked`.
   *
   * Para produto com lote controlado o critério deixa de ser antiguidade e
   * passa a ser VALIDADE: `Lot.expiresAt` ascendente, o que vence primeiro sai
   * primeiro — mesmo que tenha entrado DEPOIS de outro lote. É a inversão que
   * dá nome ao FEFO e a razão de a fase existir.
   *
   * Três decisões dentro disso:
   *
   *   * A ordenação final é feita EM MEMÓRIA, não no `orderBy`. O MySQL ordena
   *     NULL primeiro no ASC, e "lote sem validade" (que existe: nem todo lote
   *     tem data) tem de sair POR ÚLTIMO, não primeiro — material que nunca
   *     vence é o que menos urge. O `orderBy` do banco continua entregando o
   *     FIFO, que serve de desempate ESTÁVEL (`Array.sort` é estável) entre
   *     lotes com a mesma validade.
   *   * Lote JÁ VENCIDO é EXCLUÍDO dos candidatos. Não é decoração: a saída de
   *     lote vencido é recusada por `applyMovement`, então planejar picking a
   *     partir dele geraria uma tarefa impossível de executar — o operador
   *     descobriria isso na frente do endereço. É a mesma disciplina do
   *     `blocked: false` logo acima e do "a tarefa nasce executável ou não
   *     nasce" da reposição (F4.10).
   *   * Linha de saldo SEM lote de produto `lotTracked` (estoque que já existia
   *     quando a flag foi ligada) continua sendo candidata, ordenada junto dos
   *     lotes sem validade, no fim. Excluí-la deixaria esse estoque preso para
   *     sempre; consumi-la por último é o comportamento conservador.
   */
  private async planPickingFromPositions(
    tx: TransactionClient,
    productId: string,
    productCode: string,
    requiredQty: number,
    lotTracked: boolean
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
      select: {
        storagePositionId: true,
        lotId: true,
        quantity: true,
        lot: { select: { expiresAt: true } },
      },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
    });

    // FIFO (o de sempre) para produto sem lote controlado; FEFO para os
    // demais. O `filter`/`sort` só existe no segundo caso — o primeiro sai
    // daqui com exatamente a lista que a query devolveu, como antes da Fase 5.
    const candidates = lotTracked
      ? balances
          .filter(
            (balance) =>
              !balance.lot?.expiresAt || balance.lot.expiresAt.getTime() >= Date.now()
          )
          .sort((a, b) => {
            // Sem validade (lote sem data, ou linha sem lote) = nunca vence =
            // por último. `Infinity` expressa isso sem um `if` por combinação.
            const aExpiry = a.lot?.expiresAt?.getTime() ?? Number.POSITIVE_INFINITY;
            const bExpiry = b.lot?.expiresAt?.getTime() ?? Number.POSITIVE_INFINITY;
            return aExpiry - bExpiry;
          })
      : balances;

    const allocations: {
      productId: string;
      storagePositionId: string;
      lotId: string | null;
      quantity: Prisma.Decimal;
    }[] = [];
    let remaining = required;

    for (const balance of candidates) {
      if (remaining.lessThanOrEqualTo(0)) break;

      const take = Prisma.Decimal.min(remaining, balance.quantity);
      allocations.push({
        productId,
        storagePositionId: balance.storagePositionId,
        lotId: balance.lotId,
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
        // Fase 5 — a flag vem do componente já carregado pelo `include` da BOM,
        // sem uma query a mais. Ela decide FIFO vs. FEFO em
        // `planPickingFromPositions` e só é lida no caminho COM WMS.
        lotTracked: bomItem.component.lotTracked,
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
          // Fase 5 — o lote que o FEFO escolheu, gravado na tarefa de PICKING.
          // `null` para componente sem `lotTracked` (e para linha de saldo sem
          // lote de componente que passou a ser rastreado depois).
          lotId: string | null;
          quantity: Prisma.Decimal;
        }[] = [];

        for (const item of requiredItems) {
          const planned = await this.planPickingFromPositions(
            tx,
            item.componentId,
            item.componentCode,
            item.requiredQty,
            item.lotTracked
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
            // Fase 5 — o lote escolhido pelo FEFO. Sempre presente no contrato
            // (`null` para produto sem lote controlado) em vez de omitido: um
            // campo que aparece e some conforme a flag do produto obrigaria o
            // consumidor a distinguir "não tem lote" de "a versão da API não
            // manda lote".
            lotId: allocation.lotId,
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
