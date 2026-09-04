import { Prisma, WarehouseTaskStatus, WarehouseTaskType, WorkflowNodeType } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { resolveQuarantineRequirement } from './storage-rule.service';
import { pickTemplate, resolveWorkflowTasks, ResolvableTemplate } from './workflow-resolver.service';
import { ConditionRule, ReceivingContext } from './workflow-condition.service';

type TransactionClient = Prisma.TransactionClient;

/**
 * F4.1 / F4.3 do plano do WMS
 * (docs/fase-2026-09-modernizacao/WMS_IMPLEMENTATION_ANALYSIS.md, seção 5,
 * Fase 4) e seção 3.3 de `04_ARQUITETURA_MODULAR_LICENCIAMENTO.md`.
 *
 * A `WarehouseTask` é a unidade de trabalho rastreável do armazém. Com WMS
 * licenciado, o recebimento deixa de ser uma ação síncrona de tela e vira uma
 * CADEIA de tarefas; sem WMS licenciado este service nunca é chamado e nenhuma
 * linha de `warehouse_tasks` é criada.
 *
 * DIREÇÃO DE IMPORT (para não fechar ciclo de módulos, mesmo cuidado registrado
 * em `stock.service.ts` sobre `utils/stock-movement.util.ts`):
 *
 *   purchase-receipt.service.ts       ──importa──▶  warehouse-task.service.ts
 *   stock.service.ts                  ──importa──▶  warehouse-task.service.ts
 *   warehouse-task-execution.service  ──importa──▶  warehouse-task.service.ts
 *
 * e NUNCA o contrário. **Este arquivo não importa `stock.service.ts`**, e essa
 * é a regra que sustenta tudo: `stock.service.ts` importa
 * `notification-detector.service.ts`, então qualquer import de estoque a partir
 * daqui fecharia um ciclo assim que a Fase 4b conectasse a reposição ao
 * detector de notificação.
 *
 * A consequência prática é a mesma da Fase 4a, agora com mais um caso: toda
 * conclusão de tarefa COM efeito de estoque mora fora deste arquivo —
 *
 *   `ALOCACAO`                → `purchase-receipt.service.ts::completePutaway()`
 *                               (precisa de `updateProductCosts()`, domínio de
 *                                compras)
 *   `PICKING` / `REPLENISHMENT` → `warehouse-task-execution.service.ts`
 *                               (F4.8/F4.10 — precisa de `applyMovement`)
 *
 * — e este arquivo exporta os utilitários compartilhados (`loadTaskForUpdate`,
 * `assertChainOrderResolved`, `markTaskCompleted`, `assertTaskIsOpen`) que os
 * dois consomem. A criação das tarefas de `PICKING`, por não ter efeito de
 * estoque nenhum (é justamente esse o ponto de F4.8), pode e deve morar aqui.
 */

/**
 * F4.3 — a cadeia gerada por recebimento, na ordem de execução. A posição na
 * lista FILTRADA (ver `createReceiptTaskChain`) é a `sequence` gravada.
 *
 * ✅ F4.6 (Fase 4b) — RESOLVIDO o `// TODO Fase 4b` que estava aqui. A
 * `QUARENTENA` deixou de ser incondicional: `StorageRule.requiresQuarantine`
 * agora é o lugar onde se declara que um produto/categoria exige inspeção antes
 * de ser endereçado, e `resolveQuarantineRequirement()` (em
 * `storage-rule.service.ts`) decide por recebimento. O fallback na AUSÊNCIA de
 * regra continua sendo "gera", pelo mesmo argumento da Fase 4a — pular uma
 * inspeção necessária põe material não conferido no estoque disponível,
 * executar uma dispensável é um toque a mais no coletor. O que mudou é que
 * agora existe COMO desligar; antes o comportamento era inatingível por
 * configuração. Ver a nota completa em `resolveQuarantineRequirement()`.
 */
export const RECEIPT_TASK_CHAIN: WarehouseTaskType[] = [
  WarehouseTaskType.DESCARGA,
  WarehouseTaskType.CONFERENCIA,
  WarehouseTaskType.ETIQUETAGEM,
  WarehouseTaskType.QUARENTENA,
  WarehouseTaskType.ALOCACAO,
];

/**
 * F4.1 — valor de `referenceType` da referência polimórfica quando a tarefa
 * pertence a um recebimento de compra. Mesmo precedente de
 * `StockMovement.referenceType`: sem FK, porque o alvo muda de tabela conforme
 * o tipo da tarefa.
 */
export const RECEIPT_TASK_REFERENCE_TYPE = 'PURCHASE_RECEIPT';

/**
 * F4.8 — `referenceType` da tarefa de `PICKING`: `reference` é o
 * `ProductionOrder.id` que consumiu o material.
 *
 * O ID, e não `orderNumber` (que é o que o `StockMovement` da reserva sem WMS
 * usa em `reference`): a referência polimórfica de `WarehouseTask` já é por id
 * em `PURCHASE_RECEIPT`, e id não muda. Manter os dois formatos no mesmo campo
 * tornaria impossível resolver a referência sem antes olhar o `referenceType`.
 */
export const PRODUCTION_ORDER_TASK_REFERENCE_TYPE = 'PRODUCTION_ORDER';

/**
 * F4.10 — `referenceType` da tarefa de `REPLENISHMENT`: `reference` é o
 * `StoragePosition.id` da posição de PICKING que caiu abaixo do mínimo.
 *
 * A reposição é a única tarefa sem documento por trás — ela não nasce de um
 * recebimento nem de uma ordem, nasce de um ESTADO do armazém. O "documento"
 * dela é, portanto, o próprio endereço que disparou a regra, e é isso que
 * permite ao detector perguntar "já existe reposição aberta para esta posição?"
 * antes de criar outra.
 */
export const REPLENISHMENT_TASK_REFERENCE_TYPE = 'REPLENISHMENT';

/** Status a partir dos quais uma tarefa ainda pode ser concluída. */
const OPEN_STATUSES: WarehouseTaskStatus[] = [
  WarehouseTaskStatus.PENDING,
  WarehouseTaskStatus.IN_PROGRESS,
];

/** Status que contam como "etapa resolvida" para o gate de ordem da cadeia. */
const RESOLVED_STATUSES: WarehouseTaskStatus[] = [
  WarehouseTaskStatus.COMPLETED,
  WarehouseTaskStatus.CANCELLED,
];

/**
 * F4.8/F4.10 — tipos cuja CONCLUSÃO movimenta estoque a partir do que já está
 * gravado na própria tarefa. São os atendidos por `POST /:id/execute`
 * (`warehouse-task-execution.service.ts`) e recusados por `completeTask`.
 *
 * `ALOCACAO` também movimenta estoque, mas não entra nesta lista: ela é o
 * terceiro contrato (`/putaway`), porque a posição de destino e a quantidade
 * são informadas NA conclusão, não lidas da tarefa.
 */
export const STOCK_MOVING_TASK_TYPES: WarehouseTaskType[] = [
  WarehouseTaskType.PICKING,
  WarehouseTaskType.REPLENISHMENT,
];

const taskSelect = {
  id: true,
  type: true,
  status: true,
  reference: true,
  referenceType: true,
  fromPositionId: true,
  toPositionId: true,
  productId: true,
  // Fase 5 — o lote que a tarefa movimenta (FEFO no picking, herdado da linha
  // de origem na reposição). `null` para produto sem `lotTracked`.
  lotId: true,
  quantity: true,
  priority: true,
  assignedTo: true,
  sequence: true,
  version: true,
  createdAt: true,
  startedAt: true,
  completedAt: true,
} as const;

/**
 * A projeção travada por `loadTaskForUpdate`.
 *
 * F4.8/F4.10 acrescentaram `productId`, `quantity` e o par de posições: a
 * conclusão de `PICKING`/`REPLENISHMENT` movimenta estoque a partir do que está
 * gravado NA TAREFA (produto, quantidade, origem/destino), e esses campos
 * precisam vir da MESMA leitura travada — relê-los por fora do `FOR UPDATE`
 * reabriria a janela de read-then-write que o lock existe para fechar.
 *
 * A Fase 5 acrescentou `lotId` pelo MESMO motivo: o lote é parte da descrição do
 * que a tarefa movimenta (é ele que identifica a linha de saldo por posição),
 * então tem de vir da leitura travada junto com o resto.
 */
export type LockedTask = {
  id: string;
  type: WarehouseTaskType;
  status: WarehouseTaskStatus;
  reference: string | null;
  referenceType: string | null;
  sequence: number | null;
  version: number;
  startedAt: Date | null;
  productId: string | null;
  lotId: string | null;
  quantity: Prisma.Decimal | null;
  fromPositionId: string | null;
  toPositionId: string | null;
  assignedTo: string | null;
};

/**
 * SERIALIZAÇÃO (decisão D2, seção 4.4 do plano): `quantity` é `Decimal(18,4)`,
 * não `Float`. Endpoint novo expõe quantidade como STRING — o mesmo contrato
 * que `stock-position.service.ts` estabeleceu na Fase 1 e que o frontend do WMS
 * já conhece. Converter para `number` na borda jogaria fora a precisão pela
 * qual a coluna foi criada assim.
 */
const serializeQuantity = (value: Prisma.Decimal | null): string | null =>
  value === null ? null : value.toString();

const serializeTask = (task: any) => ({
  ...task,
  quantity: serializeQuantity(task.quantity ?? null),
});

/**
 * F4.3 — gera a cadeia de tarefas de um recebimento.
 *
 * Recebe o `tx` do chamador de propósito: a cadeia tem de nascer na MESMA
 * transação que cria o `PurchaseReceipt`. Um recebimento `CONFERIDO` sem
 * tarefas seria um recebimento que nunca dá entrada em estoque e que ninguém
 * consegue endereçar — pior do que a criação inteira falhar.
 *
 * Nenhuma tarefa nasce com posição: `ALOCACAO` não tem `toPositionId` porque
 * quem aloca escolhe o endereço ao CONCLUIR (e pode escolher mais de um — ver
 * `ReceiptPutaway`); as quatro anteriores existem como unidade de trabalho
 * rastreável e não têm endereço próprio nesta metade da fase.
 *
 * `productId`/`quantity` também ficam nulos: a cadeia é sobre o recebimento
 * INTEIRO, e o detalhe por item já está em `purchase_receipt_items`. Duplicá-lo
 * na tarefa criaria uma segunda verdade sobre a quantidade conferida.
 *
 * ✅ F4.6 — a `QUARENTENA` agora é CONDICIONAL (ver `RECEIPT_TASK_CHAIN`). Os
 * produtos do recebimento são lidos da MESMA transação — os itens acabaram de
 * ser criados por `purchase-receipt.service.ts::create()` e ainda não estão
 * visíveis fora dela.
 *
 * `sequence` é o índice na cadeia JÁ FILTRADA (1..N), não a posição fixa na
 * lista canônica: sem quarentena, `ALOCACAO` é a etapa 4, não a 5 com um buraco
 * na 4. O gate de ordem (`assertChainOrderResolved`) só compara `sequence`
 * entre si, então buraco não quebraria nada — mas uma cadeia que se apresenta
 * ao operador como "etapa 5 de 5" tendo quatro etapas é ruído gratuito na tela
 * do coletor.
 */
/**
 * F-WORKFLOW — WorkflowNodeType e WarehouseTaskType compartilham os mesmos 7
 * nomes de operação de propósito (ver o comentário do enum em schema.prisma).
 * `resolveWorkflowTasks` nunca devolve DECISAO no array de steps (é consumido
 * internamente pelo loop, nunca empurrado pro resultado) — o `throw` aqui é
 * só a rede de segurança de tipo, não um caminho alcançável em uso normal.
 */
function toWarehouseTaskType(type: WorkflowNodeType): WarehouseTaskType {
  if (type === 'DECISAO') {
    throw new AppError(500, 'Nó de decisão não pode virar tarefa de armazém — erro interno do resolvedor.');
  }
  return type as unknown as WarehouseTaskType;
}

export const createReceiptTaskChain = async (
  tx: TransactionClient,
  receiptId: string
): Promise<void> => {
  const items = await tx.purchaseReceiptItem.findMany({
    where: { receiptId },
    select: {
      productId: true,
      product: {
        select: {
          weight: true,
          volume: true,
          packagingType: true,
          segregationGroup: true,
          maxStackQty: true,
          lotTracked: true,
          categoryId: true,
        },
      },
    },
  });

  const receipt = await tx.purchaseReceipt.findUniqueOrThrow({
    where: { id: receiptId },
    select: { order: { select: { supplierId: true } } },
  });

  // F-WORKFLOW — o contexto que o motor de condições avalia. Lido na MESMA
  // transação que criou os itens (mesmo motivo do resto desta função:
  // `purchase-receipt.service.ts::create()` acabou de criá-los, ainda não
  // visíveis fora da transação).
  const context: ReceivingContext = {
    order: { supplierId: receipt.order.supplierId },
    items: items.map((item) => ({ product: item.product })),
  };

  const templateRows = await tx.workflowTemplate.findMany({
    where: { active: true, direction: 'ENTRADA' },
    include: { nodes: true, edges: true },
  });

  const templates: ResolvableTemplate[] = templateRows.map((t) => ({
    id: t.id,
    priority: t.priority,
    updatedAt: t.updatedAt,
    triggerRule: t.triggerRule as unknown as ConditionRule | null,
    entryNodeId: t.entryNodeId ?? '',
    nodes: t.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      conditionRule: n.conditionRule as unknown as ConditionRule | null,
    })),
    edges: t.edges.map((e) => ({
      fromNodeId: e.fromNodeId,
      toNodeId: e.toNodeId,
      branch: e.branch,
    })),
  }));

  const matched = pickTemplate(templates, context);

  let chain: WarehouseTaskType[];

  if (matched) {
    // F-WORKFLOW — caminho NOVO: um template configurado pelo admin bate com
    // este recebimento.
    chain = resolveWorkflowTasks(matched, context).map(toWarehouseTaskType);
  } else {
    // Caminho ATUAL, inalterado: nenhum template configurado bate — o
    // recebimento se comporta exatamente como antes deste projeto.
    const needsQuarantine = await resolveQuarantineRequirement(
      tx,
      items.map((item) => item.productId)
    );

    chain = RECEIPT_TASK_CHAIN.filter(
      (type) => type !== WarehouseTaskType.QUARENTENA || needsQuarantine
    );
  }

  await tx.warehouseTask.createMany({
    data: chain.map((type, index) => ({
      type,
      status: WarehouseTaskStatus.PENDING,
      reference: receiptId,
      referenceType: RECEIPT_TASK_REFERENCE_TYPE,
      sequence: index + 1,
      priority: 0,
    })),
  });
};

/**
 * F4.8 — as tarefas de `PICKING` de uma ordem de produção.
 *
 * Chamada de dentro da transação de `stock.service.ts::reserveForOrder()`, e
 * este é o ponto inteiro do item: com WMS licenciado, reservar material para
 * uma ordem NÃO debita saldo, **cria trabalho**. O débito acontece quando
 * alguém de fato vai até o endereço e tira o material de lá
 * (`warehouse-task-execution.service.ts`). Reservar sem tirar do endereço é a
 * mesma mentira que a Fase 4a eliminou na entrada — o material continua
 * fisicamente na posição, e um saldo que diz o contrário é um saldo que a
 * primeira contagem cíclica desmente.
 *
 * UMA TAREFA POR (componente × posição de origem), e não uma por componente: o
 * FIFO pode ter de varrer duas posições para juntar a quantidade necessária, e
 * cada visita a um endereço é uma parada física distinta do operador. Uma
 * tarefa que dissesse "pegue 100 espalhados por aí" não é executável num
 * coletor.
 *
 * `sequence` NULA de propósito — as tarefas de picking de uma ordem são
 * PARALELAS, não uma cadeia: nada exige que o componente A seja separado antes
 * do B, e dois operadores podem tocar corredores diferentes ao mesmo tempo. É
 * exatamente o caso que `assertChainOrderResolved` já trata saindo cedo quando
 * `sequence` é nula ("tarefa sem sequência não é barrada por ninguém").
 *
 * ✅ FASE 5 — UMA TAREFA POR (componente × posição × LOTE). A granularidade
 * ficou mais fina pelo mesmo argumento que já sustentava a divisão por posição:
 * a conclusão da tarefa debita UMA linha de `stock_position_balances`, e com
 * lote a linha é identificada por (produto, posição, lote). Uma tarefa que
 * atravessasse dois lotes do mesmo endereço não teria como ser executada por
 * uma única movimentação — e, pior, esconderia do operador QUAL lote sair, que
 * é justamente a informação pela qual esta fase existe.
 */
export const createPickingTasks = async (
  tx: TransactionClient,
  productionOrderId: string,
  allocations: {
    productId: string;
    storagePositionId: string;
    lotId?: string | null;
    quantity: Prisma.Decimal;
  }[]
): Promise<void> => {
  if (allocations.length === 0) {
    return;
  }

  await tx.warehouseTask.createMany({
    data: allocations.map((allocation) => ({
      type: WarehouseTaskType.PICKING,
      status: WarehouseTaskStatus.PENDING,
      reference: productionOrderId,
      referenceType: PRODUCTION_ORDER_TASK_REFERENCE_TYPE,
      productId: allocation.productId,
      lotId: allocation.lotId ?? null,
      quantity: allocation.quantity,
      fromPositionId: allocation.storagePositionId,
      sequence: null,
      priority: 0,
    })),
  });
};

/**
 * F4.5 — as tarefas de um recebimento, na ordem de execução.
 * Ordena por `sequence` e desempata por `createdAt`: tarefas podem compartilhar
 * a mesma `sequence` (etapas paralelas do mesmo estágio, previsto para a
 * Fase 4b), e uma ordenação instável faria a tela do supervisor "dançar" entre
 * dois refreshes.
 */
export const listByReceipt = async (receiptId: string) => {
  const receipt = await prisma.purchaseReceipt.findUnique({
    where: { id: receiptId },
    select: { id: true },
  });

  if (!receipt) {
    throw new AppError(404, 'Recebimento não encontrado');
  }

  const tasks = await prisma.warehouseTask.findMany({
    where: {
      referenceType: RECEIPT_TASK_REFERENCE_TYPE,
      reference: receiptId,
    },
    select: {
      ...taskSelect,
      assignee: { select: { id: true, name: true, email: true } },
      product: { select: { id: true, code: true, name: true } },
    },
    orderBy: [{ sequence: 'asc' }, { createdAt: 'asc' }],
  });

  return tasks.map(serializeTask);
};

/**
 * Trava a linha da tarefa (`SELECT ... FOR UPDATE`) dentro da transação do
 * chamador.
 *
 * ORDEM DE LOCK — regra desta fase, para não reabrir os deadlocks que a Fase 1
 * fechou: a tarefa é o lock MAIS EXTERNO de qualquer operação de conclusão.
 * A ordem completa da conclusão de `ALOCACAO` é
 *
 *   warehouse_tasks → purchase_receipt_items → stock_balances →
 *   stock_position_balances (crescente por id, dentro de applyMovement)
 *
 * e nunca deve ser invertida. Travar a tarefa primeiro tem um efeito colateral
 * desejado: duas conclusões concorrentes do MESMO endereçamento são
 * serializadas antes de qualquer leitura de saldo, então a segunda enxerga o
 * `ReceiptPutaway` da primeira e a validação de `acceptedQty` não pode ser
 * furada por um read-then-write.
 */
export const loadTaskForUpdate = async (
  tx: TransactionClient,
  taskId: string
): Promise<LockedTask> => {
  const rows = await tx.$queryRaw<LockedTask[]>`
    SELECT id, type, status, reference, referenceType, sequence, version, startedAt,
           productId, lotId, quantity, fromPositionId, toPositionId, assignedTo
    FROM warehouse_tasks
    WHERE id = ${taskId}
    FOR UPDATE
  `;

  if (rows.length === 0) {
    throw new AppError(404, 'Tarefa de armazém não encontrada');
  }

  const row = rows[0];

  return {
    ...row,
    // `$queryRaw` devolve a coluna DECIMAL(18,4) sem passar pelo mapeamento do
    // Prisma Client. Normalizar para `Prisma.Decimal` aqui é o que garante que
    // o consumidor (a conclusão de PICKING) faça aritmética em Decimal — a
    // decisão D2 vale igual na leitura crua.
    quantity: row.quantity === null ? null : new Prisma.Decimal(row.quantity as any),
  };
};

/** A tarefa ainda pode ser concluída? */
export const assertTaskIsOpen = (task: LockedTask): void => {
  if (!OPEN_STATUSES.includes(task.status)) {
    throw new AppError(
      409,
      `Tarefa já está em situação '${task.status}' e não pode ser concluída novamente.`
    );
  }
};

/**
 * F4.3 — GATE DE ORDEM DA CADEIA.
 *
 * Uma tarefa só pode ser concluída se toda tarefa da mesma referência com
 * `sequence` MENOR já estiver resolvida (`COMPLETED` ou `CANCELLED`). É isso
 * que faz a cadeia ser uma cadeia e não cinco tarefas soltas: sem o gate, um
 * operador poderia endereçar (`ALOCACAO`) material que ninguém descarregou,
 * conferiu ou liberou da quarentena — exatamente o furo de processo que o
 * recebimento orientado a tarefa existe para fechar.
 *
 * `CANCELLED` conta como resolvida (e não como bloqueio) de propósito: é assim
 * que uma etapa dispensada libera a seguinte, sem precisar de um status
 * `SKIPPED` só para isso.
 *
 * Tarefa sem `sequence` não tem posição na cadeia e não é barrada por ninguém —
 * o gate só se aplica a quem declara ordem.
 */
export const assertChainOrderResolved = async (
  tx: TransactionClient,
  task: LockedTask
): Promise<void> => {
  if (task.sequence === null || task.reference === null) {
    return;
  }

  const pending = await tx.warehouseTask.findFirst({
    where: {
      referenceType: task.referenceType,
      reference: task.reference,
      sequence: { lt: task.sequence },
      status: { notIn: RESOLVED_STATUSES },
    },
    select: { id: true, type: true, sequence: true },
    orderBy: { sequence: 'asc' },
  });

  if (pending) {
    throw new AppError(
      409,
      `A tarefa de ${pending.type} (etapa ${pending.sequence}) ainda não foi concluída — ` +
        'as etapas do recebimento são executadas em ordem.'
    );
  }
};

/**
 * Marca a tarefa como concluída. `version` incrementada junto (lock otimista,
 * mesmo padrão do resto do projeto) e `startedAt` preenchido se ninguém tinha
 * iniciado a tarefa — concluir sem ter iniciado é o caminho normal do desktop,
 * e deixar `startedAt` nulo tornaria impossível medir tempo de execução.
 */
export const markTaskCompleted = async (
  tx: TransactionClient,
  task: LockedTask
): Promise<void> => {
  const now = new Date();
  await tx.warehouseTask.update({
    where: { id: task.id },
    data: {
      status: WarehouseTaskStatus.COMPLETED,
      completedAt: now,
      startedAt: task.startedAt ?? now,
      version: { increment: 1 },
    },
  });
};

/**
 * Primeira execução parcial de uma tarefa: sai de `PENDING` para
 * `IN_PROGRESS` e carimba `startedAt`. Só a `ALOCACAO` usa isso hoje — ela
 * pode ser concluída em várias chamadas (um endereçamento por posição), e a
 * primeira delas é o que "começa" a tarefa.
 */
export const markTaskStarted = async (
  tx: TransactionClient,
  task: LockedTask
): Promise<void> => {
  if (task.status !== WarehouseTaskStatus.PENDING) {
    return;
  }

  await tx.warehouseTask.update({
    where: { id: task.id },
    data: {
      status: WarehouseTaskStatus.IN_PROGRESS,
      startedAt: task.startedAt ?? new Date(),
      version: { increment: 1 },
    },
  });
};

/**
 * F4.3 — conclusão de uma tarefa SEM efeito colateral de estoque
 * (`DESCARGA`, `CONFERENCIA`, `ETIQUETAGEM`, `QUARENTENA`).
 *
 * ORGANIZAÇÃO DAS CONCLUSÕES (decisão de F4.11, registrada aqui porque é onde
 * ela se enxerga): há TRÊS endpoints de conclusão, e a divisão é por CONTRATO
 * DE ENTRADA, não por tipo de tarefa —
 *
 *   `POST /:id/complete`  nada além do id (e a versão opcional). Serve as
 *                         etapas sem efeito de estoque: DESCARGA, CONFERENCIA,
 *                         ETIQUETAGEM, QUARENTENA.
 *   `POST /:id/putaway`   exige `receiptItemId` + `storagePositionId` +
 *                         `quantity` — a ALOCACAO decide o destino NA
 *                         conclusão, e pode ser chamada várias vezes.
 *   `POST /:id/execute`   nada além do id. Serve PICKING e REPLENISHMENT, cujo
 *                         efeito de estoque JÁ ESTÁ DESCRITO NA TAREFA
 *                         (produto, quantidade, origem/destino gravados na
 *                         criação) — não há o que informar.
 *
 * Unificar `complete` e `execute` numa rota só seria possível (as duas têm o
 * mesmo corpo), mas escondeu-se o oposto do que se quer: `execute` movimenta
 * estoque e `complete` não, e essa é justamente a distinção que precisa estar
 * visível no RBAC, no log e na tela. `putaway` não entra na conversa — corpo
 * diferente.
 *
 * Os tipos que este método RECUSA (400, com a rota certa na mensagem) são
 * exatamente os das outras duas rotas.
 *
 * `expectedVersion` é OPCIONAL, mesmo padrão de `production-order.service.ts`:
 * quem tem a tarefa na tela manda a versão que leu e recebe 409 se alguém
 * concluiu antes; um coletor que só tem o id da tarefa omite. Mesmo omitido, o
 * `FOR UPDATE` + a checagem de status impedem dupla conclusão — a versão é
 * proteção contra decisão tomada sobre dado velho, não contra corrida.
 *
 */
export const completeTask = async (
  taskId: string,
  expectedVersion?: number
) => {
  await prisma.$transaction(async (tx) => {
    const task = await loadTaskForUpdate(tx, taskId);

    if (task.type === WarehouseTaskType.ALOCACAO) {
      throw new AppError(
        400,
        'Tarefa de ALOCACAO é concluída informando endereço e quantidade — ' +
          'use POST /warehouse-tasks/:id/putaway.'
      );
    }

    if (STOCK_MOVING_TASK_TYPES.includes(task.type)) {
      throw new AppError(
        400,
        `Tarefa de ${task.type} movimenta estoque ao ser concluída — ` +
          'use POST /warehouse-tasks/:id/execute.'
      );
    }

    if (expectedVersion !== undefined && task.version !== expectedVersion) {
      throw new AppError(
        409,
        'Esta tarefa foi alterada por outra pessoa. Recarregue e tente novamente.'
      );
    }

    assertTaskIsOpen(task);
    await assertChainOrderResolved(tx, task);
    await markTaskCompleted(tx, task);
  });

  const updated = await prisma.warehouseTask.findUnique({
    where: { id: taskId },
    select: taskSelect,
  });

  return serializeTask(updated);
};

// ============================================================================
// F4.9 — FILA DE TAREFAS POR OPERADOR
// ============================================================================

/**
 * F4.9 — A FILA DO OPERADOR LOGADO (`GET /warehouse-tasks/my`), que é também o
 * primeiro endpoint da superfície de coletor de F4.11.
 *
 * DESENHO DA ATRIBUIÇÃO (o item pede "o mesmo espírito de
 * `CountingAssignment`/`CounterRole`", e a leitura honesta do que aquele padrão
 * ensina levou a NÃO copiar sua forma):
 *
 * `CountingAssignment` é uma tabela N:N com PAPEL (PRIMARY/SECONDARY/VALIDATOR/
 * SUPERVISOR) porque a contagem cega EXIGE que duas pessoas diferentes contem o
 * MESMO item sem se ver — o papel é o que distingue a contagem da recontagem, e
 * sem ele o processo não existe. Tarefa de armazém não tem esse requisito: um
 * palete é guardado por UMA pessoa, e uma segunda pessoa fazendo "a mesma
 * tarefa em outro papel" não é um processo de armazém, é retrabalho. Por isso a
 * atribuição aqui é a coluna `assignedTo` que a Fase 4a já criou (1:1,
 * opcional) e não uma tabela de atribuição com papéis — que seria um enum
 * inteiro sem nenhum valor que mudasse o comportamento do sistema.
 *
 * O que FOI copiado de `CountingAssignment`, porque é a parte que se aplica:
 * atribuição é ORTOGONAL ao ciclo de vida (uma tarefa atribuída continua
 * `PENDING` até alguém iniciá-la — ver a nota do enum `WarehouseTaskStatus` no
 * schema, que já tinha registrado essa decisão), e a fila mostra o que está
 * ABERTO, não o histórico.
 *
 * `includeUnassigned` existe porque a fila real de um armazém pequeno é um pool:
 * ninguém distribui tarefa, o operador pega a próxima. Default `true` — o
 * coletor de quem não usa atribuição funciona sem parâmetro nenhum.
 */
export const listMyTasks = async (
  userId: string,
  options: { includeUnassigned?: boolean; limit?: number } = {}
) => {
  const includeUnassigned = options.includeUnassigned ?? true;
  const limit = Math.min(options.limit ?? 50, 200);

  const tasks = await prisma.warehouseTask.findMany({
    where: {
      status: { in: OPEN_STATUSES },
      ...(includeUnassigned
        ? { OR: [{ assignedTo: userId }, { assignedTo: null }] }
        : { assignedTo: userId }),
    },
    select: {
      ...taskSelect,
      product: { select: { id: true, code: true, name: true } },
      // Fase 5 — o coletor precisa MOSTRAR o lote, não só gravá-lo: a tarefa
      // diz "tire 30 do lote L-2026-001", e o operador confere a etiqueta.
      // Sem isso o FEFO decidiria em silêncio e o operador pegaria o palete da
      // frente.
      lot: { select: { id: true, lotNumber: true, expiresAt: true } },
      fromPosition: { select: { id: true, code: true } },
      toPosition: { select: { id: true, code: true } },
    },
    // A ordem da FILA, e ela é a resposta a "o que eu faço agora?":
    //   1. prioridade DESC — urgência declarada vence tudo;
    //   2. `IN_PROGRESS` antes de `PENDING` (o enum ordena assim por acaso, daí
    //      o critério explícito por `startedAt`) — terminar o que já se começou
    //      antes de abrir frente nova;
    //   3. mais antiga primeiro — evita a tarefa que nunca é escolhida.
    orderBy: [{ priority: 'desc' }, { startedAt: 'asc' }, { createdAt: 'asc' }],
    take: limit,
  });

  return tasks.map(serializeTask);
};

/**
 * F4.9 — atribuir (ou desatribuir, com `assignedTo: null`) uma tarefa.
 *
 * Só tarefa ABERTA pode ser atribuída: reatribuir algo concluído não muda nada
 * no mundo físico e só falsearia o relatório de produtividade.
 *
 * Sob `FOR UPDATE` como toda escrita de tarefa desta fase — dois supervisores
 * atribuindo a mesma tarefa a operadores diferentes ao mesmo tempo é uma
 * corrida real numa tela de painel, e o resultado tem de ser "o segundo
 * sobrescreve o primeiro" de forma serializada, nunca "os dois acham que
 * ganharam".
 */
export const assignTask = async (
  taskId: string,
  assignedTo: string | null,
  expectedVersion?: number
) => {
  await prisma.$transaction(async (tx) => {
    const task = await loadTaskForUpdate(tx, taskId);

    if (expectedVersion !== undefined && task.version !== expectedVersion) {
      throw new AppError(
        409,
        'Esta tarefa foi alterada por outra pessoa. Recarregue e tente novamente.'
      );
    }

    if (!OPEN_STATUSES.includes(task.status)) {
      throw new AppError(
        409,
        `Tarefa já está em situação '${task.status}' e não pode ser reatribuída.`
      );
    }

    if (assignedTo) {
      const user = await tx.user.findUnique({
        where: { id: assignedTo },
        select: { id: true, active: true },
      });

      if (!user) {
        throw new AppError(404, 'Operador não encontrado');
      }

      // Atribuir a um usuário inativo produz uma tarefa que nunca aparece na
      // fila de ninguém — some do painel sem estar concluída.
      if (!user.active) {
        throw new AppError(400, 'Operador está inativo e não pode receber tarefas');
      }
    }

    await tx.warehouseTask.update({
      where: { id: task.id },
      data: { assignedTo, version: { increment: 1 } },
    });
  });

  const updated = await prisma.warehouseTask.findUnique({
    where: { id: taskId },
    select: {
      ...taskSelect,
      assignee: { select: { id: true, name: true, email: true } },
    },
  });

  return serializeTask(updated);
};

// ============================================================================
// F4.11 — SUPERFÍCIE DE COLETOR
// ============================================================================

/**
 * F4.11 — `POST /warehouse-tasks/:id/start`: o operador encostou o coletor na
 * tarefa.
 *
 * Marca `IN_PROGRESS` e carimba `startedAt`. Também ATRIBUI a tarefa a quem
 * iniciou, se ela estiver sem dono — é o comportamento de pool descrito em
 * `listMyTasks`, e sem isso a tarefa que alguém já começou continuaria
 * aparecendo na fila dos outros.
 *
 * IDEMPOTENTE quando quem chama é o próprio dono: iniciar de novo uma tarefa
 * que já está `IN_PROGRESS` devolve 200 com o estado atual, sem mexer em
 * `startedAt`. Um coletor perde sinal e repete requisição o tempo todo; punir
 * isso com 409 transformaria uma retentativa de rede num erro na cara do
 * operador. O que NÃO é idempotente é iniciar tarefa de OUTRO operador — aí é
 * 409 de verdade, porque duas pessoas indo ao mesmo endereço pegar o mesmo
 * material é o problema que a atribuição existe para evitar.
 */
export const startTask = async (taskId: string, userId: string) => {
  await prisma.$transaction(async (tx) => {
    const task = await loadTaskForUpdate(tx, taskId);

    assertTaskIsOpen(task);

    if (task.assignedTo && task.assignedTo !== userId) {
      throw new AppError(
        409,
        'Esta tarefa já está atribuída a outro operador.'
      );
    }

    if (task.status === WarehouseTaskStatus.IN_PROGRESS && task.assignedTo === userId) {
      return;
    }

    await tx.warehouseTask.update({
      where: { id: task.id },
      data: {
        status: WarehouseTaskStatus.IN_PROGRESS,
        startedAt: task.startedAt ?? new Date(),
        assignedTo: task.assignedTo ?? userId,
        version: { increment: 1 },
      },
    });
  });

  const updated = await prisma.warehouseTask.findUnique({
    where: { id: taskId },
    select: {
      ...taskSelect,
      product: { select: { id: true, code: true, name: true } },
      fromPosition: { select: { id: true, code: true } },
      toPosition: { select: { id: true, code: true } },
    },
  });

  return serializeTask(updated);
};

export interface ScanResult {
  taskId: string;
  code: string;
  /** `POSITION` | `PRODUCT` — o que o código leu resolveu ser. */
  match: 'POSITION' | 'PRODUCT' | null;
  ok: boolean;
  message: string;
  /** O que a tarefa esperava, para o coletor mostrar na tela de erro. */
  expected: { position: string | null; product: string | null };
}

/**
 * F4.11 — `POST /warehouse-tasks/:id/scan`: confirmação de leitura de código de
 * barras.
 *
 * O QUE ESTE ENDPOINT FAZ: resolve o código lido (endereço `ARM-RUA-AA-PP` ou
 * código de produto) e responde se ele bate com o que a tarefa espera.
 *
 * O QUE ELE NÃO FAZ, deliberadamente: **nenhum efeito colateral**. Não conclui,
 * não inicia, não reserva. O item deu essa margem ("a menos que você veja um
 * ganho claro em já avançar algum estado") e a resposta honesta é que não há
 * ganho, há risco: a leitura de código é a operação mais REPETIDA do coletor —
 * o operador bipa para conferir, bipa de novo porque não leu, bipa o vizinho
 * por engano. Uma leitura que avança estado transforma cada uma dessas em uma
 * transição de máquina de estados, e a primeira leitura errada vira uma tarefa
 * concluída no lugar errado. Validar e devolver `ok: true/false` deixa a
 * DECISÃO com o dispositivo, que é quem sabe se aquilo foi uma conferência ou o
 * gesto final.
 *
 * `ok: false` sai com HTTP **200**, não 4xx: "bipou o endereço errado" é uma
 * resposta de negócio esperada e frequente, não um erro de requisição. Um
 * coletor offline-first que trata 4xx como falha de rede entraria em retentativa
 * infinita numa leitura simplesmente errada.
 */
export const scanTask = async (taskId: string, rawCode: string): Promise<ScanResult> => {
  const code = rawCode.trim().toUpperCase();

  const task = await prisma.warehouseTask.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      type: true,
      status: true,
      productId: true,
      fromPositionId: true,
      toPositionId: true,
      product: { select: { id: true, code: true } },
      fromPosition: { select: { id: true, code: true } },
      toPosition: { select: { id: true, code: true } },
    },
  });

  if (!task) {
    throw new AppError(404, 'Tarefa de armazém não encontrada');
  }

  // A posição que a tarefa espera: ORIGEM para PICKING (o operador vai até o
  // endereço tirar material), DESTINO para as demais. Quando há as duas
  // (REPLENISHMENT), qualquer uma das duas é uma leitura válida — o operador
  // bipa a origem ao coletar e o destino ao guardar, na mesma tarefa.
  const expectedPositions = [task.fromPosition?.code, task.toPosition?.code].filter(
    (value): value is string => Boolean(value)
  );

  const expected = {
    position: expectedPositions.join(' / ') || null,
    product: task.product?.code ?? null,
  };

  if (expectedPositions.includes(code)) {
    return {
      taskId: task.id,
      code,
      match: 'POSITION',
      ok: true,
      message: `Endereço ${code} confirmado.`,
      expected,
    };
  }

  if (task.product && task.product.code.toUpperCase() === code) {
    return {
      taskId: task.id,
      code,
      match: 'PRODUCT',
      ok: true,
      message: `Produto ${code} confirmado.`,
      expected,
    };
  }

  // O código existe no sistema mas é de OUTRO endereço/produto? A distinção
  // muda a mensagem que o operador lê: "endereço errado" (ele está no lugar
  // errado) é acionável; "código não encontrado" (etiqueta ilegível ou de outro
  // sistema) é outro problema, com outra reação.
  const position = await prisma.storagePosition.findUnique({
    where: { code },
    select: { id: true, code: true },
  });

  if (position) {
    return {
      taskId: task.id,
      code,
      match: 'POSITION',
      ok: false,
      message: expected.position
        ? `Endereço incorreto. Esta tarefa espera ${expected.position}.`
        : 'Esta tarefa não tem endereço associado.',
      expected,
    };
  }

  const product = await prisma.product.findUnique({
    where: { code },
    select: { id: true, code: true },
  });

  if (product) {
    return {
      taskId: task.id,
      code,
      match: 'PRODUCT',
      ok: false,
      message: expected.product
        ? `Produto incorreto. Esta tarefa espera ${expected.product}.`
        : 'Esta tarefa não tem produto associado.',
      expected,
    };
  }

  return {
    taskId: task.id,
    code,
    match: null,
    ok: false,
    message: `Código ${code} não corresponde a nenhum endereço ou produto cadastrado.`,
    expected,
  };
};

/**
 * Usado por `purchase-receipt.service.ts::cancel()`: as tarefas de um
 * recebimento não são apagadas em cascata — a referência é POLIMÓRFICA, não há
 * FK que cascateie —, então a exclusão é explícita.
 *
 * Apaga em vez de marcar `CANCELLED` porque o `cancel()` do recebimento apaga o
 * próprio `PurchaseReceipt` (comportamento que já existia): tarefas `CANCELLED`
 * apontando por `reference` para um recebimento que não existe mais seriam
 * lixo referencial que nenhuma consulta consegue resolver. O status `CANCELLED`
 * continua existindo para o caso oposto — encerrar uma etapa sem apagar o
 * documento (Fase 4b).
 */
export const deleteTasksForReceipt = async (
  tx: TransactionClient,
  receiptId: string
): Promise<void> => {
  await tx.warehouseTask.deleteMany({
    where: {
      referenceType: RECEIPT_TASK_REFERENCE_TYPE,
      reference: receiptId,
    },
  });
};

export default {
  RECEIPT_TASK_CHAIN,
  RECEIPT_TASK_REFERENCE_TYPE,
  PRODUCTION_ORDER_TASK_REFERENCE_TYPE,
  REPLENISHMENT_TASK_REFERENCE_TYPE,
  STOCK_MOVING_TASK_TYPES,
  createReceiptTaskChain,
  createPickingTasks,
  listByReceipt,
  listMyTasks,
  assignTask,
  startTask,
  scanTask,
  completeTask,
  loadTaskForUpdate,
  assertTaskIsOpen,
  assertChainOrderResolved,
  markTaskCompleted,
  markTaskStarted,
  deleteTasksForReceipt,
};
