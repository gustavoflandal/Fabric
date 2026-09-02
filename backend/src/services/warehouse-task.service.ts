import { Prisma, WarehouseTaskStatus, WarehouseTaskType } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';

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
 *   purchase-receipt.service.ts  ──importa──▶  warehouse-task.service.ts
 *
 * e NUNCA o contrário. Por isso a conclusão da tarefa de `ALOCACAO` — que é a
 * única com efeito colateral de estoque e precisa de `updateProductCosts()` —
 * mora em `purchase-receipt.service.ts::completePutaway()`, e não aqui;
 * este arquivo exporta os utilitários compartilhados (`loadTaskForUpdate`,
 * `assertChainOrderResolved`, `markTaskCompleted`) que aquele método consome.
 */

/**
 * F4.3 — a cadeia gerada por recebimento, na ordem de execução. O índice + 1 é
 * a `sequence` gravada em cada tarefa.
 *
 * `QUARENTENA` é gerada SEMPRE nesta metade da fase.
 * // TODO Fase 4b: a condicionalidade da quarentena depende de `StorageRule`
 * // (F4.6), que ainda não existe — é a regra de armazenagem que sabe se o
 * // produto/fornecedor exige inspeção antes de endereçar. Até lá, gerar sempre
 * // é a escolha segura: pular uma etapa que podia ser necessária é um erro de
 * // processo (material não inspecionado vai para o estoque disponível);
 * // executar uma etapa dispensável é só um passo a mais no coletor. Inventar
 * // aqui um critério de negócio ad-hoc (por categoria, por fornecedor) seria
 * // criar uma regra paralela que `StorageRule` teria de desfazer depois.
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
 * o tipo da tarefa (na Fase 4b entram separação e reposição).
 */
export const RECEIPT_TASK_REFERENCE_TYPE = 'PURCHASE_RECEIPT';

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

const taskSelect = {
  id: true,
  type: true,
  status: true,
  reference: true,
  referenceType: true,
  fromPositionId: true,
  toPositionId: true,
  productId: true,
  quantity: true,
  priority: true,
  assignedTo: true,
  sequence: true,
  version: true,
  createdAt: true,
  startedAt: true,
  completedAt: true,
} as const;

type LockedTask = {
  id: string;
  type: WarehouseTaskType;
  status: WarehouseTaskStatus;
  reference: string | null;
  referenceType: string | null;
  sequence: number | null;
  version: number;
  startedAt: Date | null;
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
 */
export const createReceiptTaskChain = async (
  tx: TransactionClient,
  receiptId: string
): Promise<void> => {
  await tx.warehouseTask.createMany({
    data: RECEIPT_TASK_CHAIN.map((type, index) => ({
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
    SELECT id, type, status, reference, referenceType, sequence, version, startedAt
    FROM warehouse_tasks
    WHERE id = ${taskId}
    FOR UPDATE
  `;

  if (rows.length === 0) {
    throw new AppError(404, 'Tarefa de armazém não encontrada');
  }

  return rows[0];
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
 * `ALOCACAO` é recusada aqui de propósito, com 400 e a rota certa na mensagem:
 * concluí-la é o momento em que o material entra no saldo, exige endereço e
 * quantidade, e mora em `purchase-receipt.service.ts::completePutaway()`. Um
 * endpoint genérico que "também" fizesse isso quando o tipo fosse `ALOCACAO`
 * teria dois contratos de corpo diferentes na mesma rota.
 *
 * `expectedVersion` é OPCIONAL, mesmo padrão de `production-order.service.ts`:
 * quem tem a tarefa na tela manda a versão que leu e recebe 409 se alguém
 * concluiu antes; um coletor que só tem o id da tarefa omite. Mesmo omitido, o
 * `FOR UPDATE` + a checagem de status impedem dupla conclusão — a versão é
 * proteção contra decisão tomada sobre dado velho, não contra corrida.
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
  createReceiptTaskChain,
  listByReceipt,
  completeTask,
  loadTaskForUpdate,
  assertTaskIsOpen,
  assertChainOrderResolved,
  markTaskCompleted,
  markTaskStarted,
  deleteTasksForReceipt,
};
