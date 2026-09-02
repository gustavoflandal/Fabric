import { Prisma, StockMovementType, WarehouseTaskType } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import stockService from './stock.service';
import {
  PRODUCTION_ORDER_TASK_REFERENCE_TYPE,
  STOCK_MOVING_TASK_TYPES,
  assertChainOrderResolved,
  assertTaskIsOpen,
  loadTaskForUpdate,
  markTaskCompleted,
} from './warehouse-task.service';

/**
 * F4.8 / F4.10 do plano do WMS — CONCLUSÃO DAS TAREFAS QUE MOVIMENTAM ESTOQUE
 * a partir do que já está gravado nelas: `PICKING` e `REPLENISHMENT`.
 *
 * POR QUE ESTE ARQUIVO EXISTE (e não é um método de `warehouse-task.service.ts`)
 * — é o mesmo motivo, e o mesmo precedente, da Fase 4a:
 *
 *   `warehouse-task.service.ts` NÃO importa `stock.service.ts`, porque
 *   `stock.service.ts` importa `notification-detector.service.ts` e, a partir de
 *   F4.10, o detector participa do fluxo de armazém. O ciclo se fecharia no
 *   primeiro import. A Fase 4a resolveu isso pondo `completePutaway()` em
 *   `purchase-receipt.service.ts` (que já era dono de `updateProductCosts`);
 *   `PICKING`/`REPLENISHMENT` não pertencem a compras nem a nenhum outro
 *   service existente, então ganham o seu.
 *
 * A direção fica:
 *
 *   warehouse-task-execution.service ──▶ stock.service ──▶ notification-detector
 *                    │
 *                    └──▶ warehouse-task.service  (lock, gates, conclusão)
 *
 * e nada aponta de volta.
 *
 * ORDEM DE LOCK — a mesma invariante da Fase 4a, com um degrau a menos (não há
 * item de recebimento envolvido):
 *
 *   1. `warehouse_tasks`         (FOR UPDATE, em `loadTaskForUpdate`)
 *   2. `stock_balances`          (dentro de `applyMovement`)
 *   3. `stock_position_balances` (idem, crescente por id)
 *
 * Travar a tarefa primeiro serializa duas conclusões da MESMA tarefa antes de
 * qualquer leitura de saldo — é o que impede que um duplo clique (ou uma
 * retentativa de coletor com sinal ruim) gere duas saídas de estoque para o
 * mesmo trabalho físico.
 */

/**
 * Conclui uma tarefa de `PICKING` ou `REPLENISHMENT`.
 *
 * SEM CORPO ALÉM DA VERSÃO OPCIONAL, e essa é a decisão de contrato: produto,
 * quantidade e posições foram gravados na CRIAÇÃO da tarefa (o FIFO já
 * escolheu, o detector de reposição já escolheu), então não há o que informar.
 * É o oposto de `/putaway`, onde o destino só é conhecido na conclusão.
 *
 * SEM CONCLUSÃO PARCIAL, ao contrário de `/putaway`: uma tarefa de picking de
 * 100 unidades numa posição é uma unidade de trabalho indivisível — "separei
 * 60" não é um estado intermediário do mesmo trabalho, é um trabalho
 * diferente, e representá-lo exigiria dividir a tarefa (com replanejamento do
 * FIFO para as 40 restantes, que podem já ter sido consumidas por outra ordem).
 * Divergência entre o planejado e o encontrado no endereço é tratada pelo
 * inventário (Fase 3), não silenciosamente pelo picking. O que acontece hoje se
 * o material não estiver lá: `applyMovement` recusa com "estoque insuficiente na
 * posição" e a tarefa continua aberta para replanejamento.
 *
 * EFEITO DE ESTOQUE POR TIPO:
 *   `PICKING`       → `OUT` com `fromPositionId`. O material sai do armazém
 *                     para a produção; o destino não é um endereço.
 *   `REPLENISHMENT` → `TRANSFER` (`from` = pulmão, `to` = picking). Reposição
 *                     não cria nem consome estoque, só o muda de lugar — e
 *                     `applyMovement` já trata `TRANSFER` como delta ZERO no
 *                     saldo agregado (F2.1), que é exatamente o correto aqui.
 */
export const executeTask = async (
  taskId: string,
  userId: string,
  expectedVersion?: number
) => {
  const result = await prisma.$transaction(async (tx) => {
    // ---- LOCK 1: a tarefa ---------------------------------------------------
    const task = await loadTaskForUpdate(tx, taskId);

    if (!STOCK_MOVING_TASK_TYPES.includes(task.type)) {
      throw new AppError(
        400,
        `Tarefa de ${task.type} não é concluída por esta rota — ` +
          (task.type === WarehouseTaskType.ALOCACAO
            ? 'use POST /warehouse-tasks/:id/putaway.'
            : 'use POST /warehouse-tasks/:id/complete.')
      );
    }

    if (expectedVersion !== undefined && task.version !== expectedVersion) {
      throw new AppError(
        409,
        'Esta tarefa foi alterada por outra pessoa. Recarregue e tente novamente.'
      );
    }

    assertTaskIsOpen(task);

    // Uma tarefa atribuída só é executada pelo dono. Sem esta guarda, a
    // atribuição de F4.9 seria decorativa: qualquer um poderia executar o
    // trabalho de outro, e a fila deixaria de dizer quem está fazendo o quê.
    if (task.assignedTo && task.assignedTo !== userId) {
      throw new AppError(409, 'Esta tarefa está atribuída a outro operador.');
    }

    // Herdado da Fase 4a, e ainda aplicável: tarefas de PICKING nascem sem
    // `sequence` (são paralelas), então o gate sai cedo. Mantido na chamada por
    // ser a garantia genérica — se um dia uma cadeia de expedição declarar
    // ordem, ela já é respeitada aqui sem alteração.
    await assertChainOrderResolved(tx, task);

    if (!task.productId || task.quantity === null) {
      throw new AppError(
        400,
        `Tarefa de ${task.type} sem produto ou quantidade não pode ser executada.`
      );
    }

    if (task.quantity.lessThanOrEqualTo(0)) {
      throw new AppError(400, 'Quantidade da tarefa deve ser maior que zero');
    }

    // `applyMovement` recebe `quantity` como `number` (o contrato de
    // `StockMovementDto`, herdado da Fase 1 — `StockMovement.quantity` ainda é
    // Float, a migração para Decimal é o item 4.1 do cronograma, adiado com
    // justificativa). A conversão é feita AQUI, num ponto só e explícito, em
    // vez de espalhar `Number(...)` pelo caminho.
    const quantity = task.quantity.toNumber();

    let movement;

    if (task.type === WarehouseTaskType.PICKING) {
      if (!task.fromPositionId) {
        throw new AppError(
          400,
          'Tarefa de PICKING sem posição de origem não pode ser executada.'
        );
      }

      // ---- LOCKS 2 e 3 + a movimentação, na MESMA transação -----------------
      movement = await stockService.registerMovementInTransaction(tx, {
        productId: task.productId,
        type: StockMovementType.OUT,
        quantity,
        reason: 'Separação para produção',
        // `reference`/`referenceType` iguais aos do caminho SEM WMS: a reserva
        // direta grava (`orderNumber`, 'MANUAL'), e é o par que os relatórios
        // de consumo já procuram. Divergir aqui faria a mesma saída de material
        // aparecer de dois jeitos conforme a licença.
        reference: await resolveOrderNumber(tx, task.reference, task.referenceType),
        referenceType: 'MANUAL',
        userId,
        notes: `Separação (tarefa ${task.id})`,
        fromPositionId: task.fromPositionId,
        // ✅ FASE 5 — o lote gravado na tarefa pelo FEFO. É ele que identifica
        // a LINHA de saldo por posição a debitar; sem ele, a saída tentaria
        // debitar a linha SEM lote daquele endereço (que não existe para
        // produto rastreado) e falharia com "estoque insuficiente na posição".
        //
        // É também aqui que o bloqueio de saída de lote vencido pega o picking:
        // `applyMovement` recusa um `OUT` de lote com `expiresAt` no passado.
        // Uma tarefa planejada com lote válido cujo vencimento passou entre o
        // planejamento e a execução falha na conclusão — e é o comportamento
        // correto: quem venceu na prateleira não pode ir para a produção.
        lotId: task.lotId ?? undefined,
      });
    } else {
      if (!task.fromPositionId || !task.toPositionId) {
        throw new AppError(
          400,
          'Tarefa de REPLENISHMENT exige posição de origem e de destino.'
        );
      }

      movement = await stockService.registerMovementInTransaction(tx, {
        productId: task.productId,
        type: StockMovementType.TRANSFER,
        quantity,
        reason: 'Reposição de área de picking',
        reference: task.reference ?? undefined,
        referenceType: 'MANUAL',
        userId,
        notes: `Reposição (tarefa ${task.id})`,
        fromPositionId: task.fromPositionId,
        toPositionId: task.toPositionId,
        // ✅ FASE 5 — o lote herdado da linha de saldo de origem na criação da
        // tarefa. Um `TRANSFER` não reetiqueta material: o MESMO lote sai do
        // pulmão e chega ao picking, então as duas pernas usam este único
        // `lotId` (ver a nota do campo no schema sobre não haver par from/to).
        lotId: task.lotId ?? undefined,
      });
    }

    await markTaskCompleted(tx, task);

    return { taskId: task.id, type: task.type, movementId: movement.id };
  });

  const updated = await prisma.warehouseTask.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      type: true,
      status: true,
      productId: true,
      lotId: true,
      quantity: true,
      fromPositionId: true,
      toPositionId: true,
      assignedTo: true,
      version: true,
      startedAt: true,
      completedAt: true,
    },
  });

  return {
    task: {
      ...updated,
      quantity: updated?.quantity?.toString() ?? null,
    },
    movementId: result.movementId,
  };
};

/**
 * A tarefa guarda o `ProductionOrder.id` em `reference` (ver
 * `PRODUCTION_ORDER_TASK_REFERENCE_TYPE`), mas a movimentação de estoque do
 * caminho sem WMS grava o `orderNumber`. Esta função faz a tradução no único
 * ponto em que os dois formatos se encontram, para que o histórico de
 * movimentação fique idêntico nos dois modos.
 *
 * Ordem de produção apagada entre a criação e a conclusão da tarefa: cai no
 * fallback (o id), porque perder a rastreabilidade inteira por causa de um
 * documento ausente seria pior do que registrar a referência menos legível.
 */
const resolveOrderNumber = async (
  tx: Prisma.TransactionClient,
  reference: string | null,
  referenceType: string | null
): Promise<string | undefined> => {
  if (!reference) {
    return undefined;
  }

  if (referenceType !== PRODUCTION_ORDER_TASK_REFERENCE_TYPE) {
    return reference;
  }

  const order = await tx.productionOrder.findUnique({
    where: { id: reference },
    select: { orderNumber: true },
  });

  return order?.orderNumber ?? reference;
};

/**
 * As tarefas de separação de uma ordem de produção — a contrapartida de
 * `listByReceipt` (F4.5) para o lado da saída. Usada pela tela de
 * acompanhamento e pelos testes.
 */
export const listByProductionOrder = async (productionOrderId: string) => {
  const order = await prisma.productionOrder.findUnique({
    where: { id: productionOrderId },
    select: { id: true },
  });

  if (!order) {
    throw new AppError(404, 'Ordem de produção não encontrada');
  }

  const tasks = await prisma.warehouseTask.findMany({
    where: {
      referenceType: PRODUCTION_ORDER_TASK_REFERENCE_TYPE,
      reference: productionOrderId,
    },
    select: {
      id: true,
      type: true,
      status: true,
      productId: true,
      lotId: true,
      quantity: true,
      fromPositionId: true,
      priority: true,
      assignedTo: true,
      version: true,
      createdAt: true,
      startedAt: true,
      completedAt: true,
      product: { select: { id: true, code: true, name: true } },
      // Fase 5 — a tela de acompanhamento mostra de qual lote cada separação sai.
      lot: { select: { id: true, lotNumber: true, expiresAt: true } },
      fromPosition: { select: { id: true, code: true } },
      assignee: { select: { id: true, name: true } },
    },
    orderBy: [{ createdAt: 'asc' }],
  });

  return tasks.map((task) => ({
    ...task,
    quantity: task.quantity?.toString() ?? null,
  }));
};

export default {
  executeTask,
  listByProductionOrder,
};
