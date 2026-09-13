import {
  Prisma,
  SalesOrderStatus,
  ShipmentStatus,
  WarehouseTaskStatus,
} from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { SEQUENCE_PREFIXES, nextDocumentNumber } from './document-sequence.service';
import stockService from './stock.service';
import {
  SHIPMENT_TASK_REFERENCE_TYPE,
  createPickingTasks,
} from './warehouse-task.service';

/**
 * EXPEDIÇÃO — ROMANEIO.
 *
 * O romaneio é a unidade de EXPEDIÇÃO FÍSICA: um pedido de venda pode gerar
 * vários (expedição parcial), cada um com o seu próprio ciclo
 * PENDING → SEPARATING → DISPATCHED.
 *
 * ONDE O ESTOQUE SE MOVE — em UM lugar só, e não é aqui: na conclusão da tarefa
 * de `PICKING` (`POST /warehouse-tasks/:id/execute`), exatamente como já
 * acontece para a ordem de produção desde F4.8. Este service:
 *
 *   * `startSeparation()` PLANEJA (FIFO/FEFO, via
 *     `stockService.planPickingFromPositions`) e CRIA as tarefas — sem debitar
 *     nada, porque o material continua fisicamente na posição até alguém ir lá
 *     tirá-lo (o argumento inteiro está em `reserveForOrder`).
 *   * `dispatch()` apenas CONFIRMA que o que já foi separado saiu: transição de
 *     status + `dispatchedAt` + acumulação de `shippedQty`. NENHUM
 *     `StockMovement` novo. Criar um segundo movimento no despacho debitaria
 *     duas vezes o mesmo material.
 *
 * DEPENDÊNCIA DE MÓDULO: a separação do romaneio usa a maquinaria de tarefa do
 * WMS. Numa instalação com EXPEDICAO licenciado e WMS não, as tarefas nasceriam
 * sem que `/warehouse-tasks/*` existisse para executá-las — ou seja, EXPEDICAO
 * depende de WMS na prática. Isso está registrado aqui e no relatório da etapa;
 * um caminho "sem WMS" (baixa direta no despacho) seria um segundo fluxo de
 * saída para manter em paralelo e foi deixado fora do escopo desta etapa.
 */

export interface CreateShipmentDto {
  salesOrderId: string;
  notes?: string | null;
  items: {
    salesOrderItemId: string;
    quantity: number;
  }[];
}

export interface ShipmentFilters {
  status?: string;
  salesOrderId?: string;
  warehouseId?: string;
}

/**
 * Romaneio que ainda RESERVA quantidade do pedido: já prometeu material mas
 * ainda não o expediu. É o conjunto que entra no cálculo de "quanto ainda posso
 * romanear deste item" em `create()`.
 *
 * `READY` está aqui mesmo não sendo produzido por nenhuma rota desta etapa (o
 * ciclo vai PENDING → SEPARATING → DISPATCHED): ele existe no enum para uma
 * futura transição "separação concluída, aguardando carga", e deixá-lo de fora
 * desta lista transformaria a introdução dessa transição num bug silencioso de
 * dupla reserva.
 */
const OPEN_SHIPMENT_STATUSES: ShipmentStatus[] = [
  ShipmentStatus.PENDING,
  ShipmentStatus.SEPARATING,
  ShipmentStatus.READY,
];

/**
 * Tolerância de comparação de quantidade. `SalesOrderItem.quantity`/`shippedQty`
 * são `Float` (DOUBLE) no banco — herdado do padrão de `PurchaseOrderItem` —, e
 * somar 3 × 33.33 e comparar com 99.99 por igualdade exata erra. A tolerância
 * é o que faz "expediu tudo" significar o que o usuário entende por isso.
 */
const QTY_EPSILON = 1e-6;

const shipmentInclude = {
  salesOrder: {
    select: {
      id: true,
      orderNumber: true,
      status: true,
      customer: { select: { id: true, code: true, name: true, document: true } },
    },
  },
  warehouse: { select: { id: true, code: true, name: true } },
  creator: { select: { id: true, name: true, email: true } },
  items: {
    include: {
      product: {
        select: {
          id: true,
          code: true,
          name: true,
          lotTracked: true,
          unit: { select: { id: true, code: true, symbol: true } },
        },
      },
      salesOrderItem: {
        select: { id: true, quantity: true, pickedQty: true, shippedQty: true },
      },
      lot: { select: { id: true, lotNumber: true, expiresAt: true } },
    },
  },
} satisfies Prisma.ShipmentInclude;

/**
 * As tarefas de separação de um romaneio — a contrapartida de
 * `listByProductionOrder` (warehouse-task-execution.service.ts) para o lado da
 * expedição, com o MESMO `select` e a mesma serialização de `quantity`
 * (`Decimal` sai como string, decisão D2 do WMS), para que o frontend trate as
 * duas listas com o mesmo componente.
 *
 * Vem embutida no detalhe do romaneio de propósito: a tela de acompanhamento
 * precisa do romaneio E das tarefas juntos, e uma segunda chamada só para isso
 * seria um round-trip garantido em toda abertura de tela.
 */
const listTasks = async (
  client: Prisma.TransactionClient | typeof prisma,
  shipmentId: string
) => {
  const tasks = await client.warehouseTask.findMany({
    where: {
      referenceType: SHIPMENT_TASK_REFERENCE_TYPE,
      reference: shipmentId,
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

export class ShipmentService {
  /**
   * Cria o romaneio a partir do pedido, admitindo EXPEDIÇÃO PARCIAL.
   *
   * O teto de cada item não é `quantity`, é
   * `quantity - shippedQty - (o que outros romaneios ABERTOS já prometeram)`.
   * Sem a terceira parcela, dois romaneios abertos do mesmo pedido poderiam
   * cada um pedir a quantidade inteira e só a segunda separação descobriria
   * que o material não existe — na frente do endereço, com o operador parado.
   */
  async create(data: CreateShipmentDto, createdBy: string) {
    const order = await prisma.salesOrder.findUnique({
      where: { id: data.salesOrderId },
      include: {
        items: true,
        shipments: {
          where: { status: { in: OPEN_SHIPMENT_STATUSES } },
          include: { items: true },
        },
      },
    });

    if (!order) {
      throw new AppError(404, 'Pedido de venda não encontrado');
    }

    if (
      order.status !== SalesOrderStatus.CONFIRMED &&
      order.status !== SalesOrderStatus.SEPARATING
    ) {
      throw new AppError(
        400,
        'Só é possível gerar romaneio de pedido CONFIRMADO ou em SEPARAÇÃO. ' +
          `Status atual: ${order.status}`
      );
    }

    // Quanto cada item do pedido já está prometido em romaneios ABERTOS.
    const reservedByItem = new Map<string, number>();
    for (const shipment of order.shipments) {
      for (const item of shipment.items) {
        reservedByItem.set(
          item.salesOrderItemId,
          (reservedByItem.get(item.salesOrderItemId) ?? 0) + item.quantity
        );
      }
    }

    const itemsById = new Map(order.items.map((item) => [item.id, item]));
    const seen = new Set<string>();
    const toCreate: {
      salesOrderItemId: string;
      productId: string;
      quantity: number;
    }[] = [];

    for (const requested of data.items) {
      const orderItem = itemsById.get(requested.salesOrderItemId);

      if (!orderItem) {
        throw new AppError(
          400,
          `Item ${requested.salesOrderItemId} não pertence ao pedido ${order.orderNumber}`
        );
      }

      // O mesmo item duas vezes no payload passaria por cada checagem de saldo
      // isoladamente e estouraria o teto na soma. Recusar é mais honesto do que
      // somar silenciosamente as duas linhas.
      if (seen.has(requested.salesOrderItemId)) {
        throw new AppError(
          400,
          `Item ${requested.salesOrderItemId} aparece mais de uma vez no romaneio`
        );
      }
      seen.add(requested.salesOrderItemId);

      const reserved = reservedByItem.get(orderItem.id) ?? 0;
      const available = orderItem.quantity - orderItem.shippedQty - reserved;

      if (requested.quantity > available + QTY_EPSILON) {
        throw new AppError(
          400,
          `Quantidade indisponível para o item do pedido ${order.orderNumber}: ` +
            `pedido ${orderItem.quantity}, já expedido ${orderItem.shippedQty}, ` +
            `em romaneios abertos ${reserved}, disponível ${available} — ` +
            `solicitado ${requested.quantity}.`
        );
      }

      toCreate.push({
        salesOrderItemId: orderItem.id,
        productId: orderItem.productId,
        quantity: requested.quantity,
      });
    }

    return prisma.$transaction(async (tx) => {
      const shipmentNumber = await nextDocumentNumber(tx, SEQUENCE_PREFIXES.SHIPMENT);

      return tx.shipment.create({
        data: {
          shipmentNumber,
          salesOrderId: order.id,
          // HERDADO do pedido, nunca do payload — ver a nota no validator.
          warehouseId: order.warehouseId,
          status: ShipmentStatus.PENDING,
          notes: data.notes || null,
          createdBy,
          items: {
            create: toCreate.map((item) => ({
              salesOrderItemId: item.salesOrderItemId,
              productId: item.productId,
              quantity: item.quantity,
              // O lote só é conhecido na separação (o FEFO escolhe) e pode ser
              // mais de um por item — a rastreabilidade real fica na
              // `WarehouseTask`/`StockMovement`. Ver a nota no schema.
              lotId: null,
            })),
          },
        },
        include: shipmentInclude,
      });
    });
  }

  async getAll(page = 1, limit = 20, filters?: ShipmentFilters) {
    const skip = (page - 1) * limit;
    const where: Prisma.ShipmentWhereInput = {};

    if (filters?.status) where.status = filters.status as ShipmentStatus;
    if (filters?.salesOrderId) where.salesOrderId = filters.salesOrderId;
    if (filters?.warehouseId) where.warehouseId = filters.warehouseId;

    const [shipments, total] = await Promise.all([
      prisma.shipment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: shipmentInclude,
      }),
      prisma.shipment.count({ where }),
    ]);

    return {
      data: shipments,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async getById(id: string) {
    const shipment = await prisma.shipment.findUnique({
      where: { id },
      include: shipmentInclude,
    });

    if (!shipment) {
      throw new AppError(404, 'Romaneio não encontrado');
    }

    const tasks = await listTasks(prisma, shipment.id);

    return { ...shipment, pickingTasks: tasks };
  }

  /**
   * PENDING → SEPARATING: planeja a alocação e cria as tarefas de `PICKING`.
   *
   * TUDO OU NADA, e é o ponto inteiro do método: o planejamento de cada item e a
   * criação das tarefas acontecem na MESMA transação, então um item sem saldo
   * endereçado suficiente aborta o romaneio inteiro (400, com a mensagem de
   * `planPickingFromPositions` dizendo o produto e as quantidades). Criar
   * tarefas para os itens que couberam e deixar o resto em silêncio geraria um
   * romaneio que o operador separa por inteiro e que nunca fecha.
   *
   * SOBRE-ALOCAÇÃO CONCORRENTE: herdada de `reserveForOrder`, com o mesmo
   * raciocínio — o planejamento não trava saldo de posição (não o altera), então
   * dois romaneios podem planejar do mesmo endereço; a primeira CONCLUSÃO
   * debita e a segunda falha com "estoque insuficiente na posição", sob o lock
   * de `applyMovement`. O saldo nunca fica negativo.
   */
  async startSeparation(id: string) {
    return prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!shipment) {
        throw new AppError(404, 'Romaneio não encontrado');
      }

      if (shipment.status !== ShipmentStatus.PENDING) {
        throw new AppError(
          400,
          `Só é possível iniciar a separação de um romaneio PENDENTE. Status atual: ${shipment.status}`
        );
      }

      if (shipment.items.length === 0) {
        throw new AppError(400, 'Romaneio sem itens não pode ser separado');
      }

      // `code`/`lotTracked` de cada produto numa query só (e não uma por item):
      // são as duas entradas de `planPickingFromPositions` — o código entra na
      // mensagem de erro e a flag decide FIFO vs. FEFO.
      const products = await tx.product.findMany({
        where: { id: { in: shipment.items.map((item) => item.productId) } },
        select: { id: true, code: true, lotTracked: true },
      });
      const productById = new Map(products.map((p) => [p.id, p]));

      const allocations: {
        productId: string;
        storagePositionId: string;
        lotId: string | null;
        quantity: Prisma.Decimal;
      }[] = [];

      for (const item of shipment.items) {
        const product = productById.get(item.productId);
        if (!product) {
          throw new AppError(400, `Produto ${item.productId} não encontrado`);
        }

        // A MESMA alocação da ordem de produção, literalmente a mesma função —
        // FIFO para produto sem lote, FEFO para produto com lote controlado,
        // posição bloqueada fora, lote vencido fora.
        const planned = await stockService.planPickingFromPositions(
          tx,
          product.id,
          product.code,
          item.quantity,
          product.lotTracked
        );

        allocations.push(...planned);
      }

      await createPickingTasks(
        tx,
        { referenceId: shipment.id, referenceType: SHIPMENT_TASK_REFERENCE_TYPE },
        allocations
      );

      // O pedido acompanha o romaneio: assim que QUALQUER romaneio dele entra em
      // separação, o pedido está em separação. `CONFIRMED` é o único status de
      // onde essa transição parte — um pedido que já está SEPARATING (porque
      // outro romaneio parcial começou antes) fica como está.
      if (shipment.salesOrderId) {
        await tx.salesOrder.updateMany({
          where: { id: shipment.salesOrderId, status: SalesOrderStatus.CONFIRMED },
          data: { status: SalesOrderStatus.SEPARATING },
        });
      }

      const updated = await tx.shipment.update({
        where: { id },
        data: { status: ShipmentStatus.SEPARATING },
        include: shipmentInclude,
      });

      return { ...updated, pickingTasks: await listTasks(tx, id) };
    });
  }

  /**
   * SEPARATING/READY → DISPATCHED. NÃO gera movimentação de estoque: o material
   * já saiu do endereço quando a tarefa de picking foi concluída.
   *
   * O gate é "toda tarefa deste romaneio está COMPLETED". Tarefa CANCELADA
   * também barra: cancelar uma tarefa significa que aquele material NÃO foi
   * separado, e despachar assim mesmo registraria como expedido algo que
   * ninguém tirou da prateleira.
   */
  async dispatch(id: string) {
    return prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!shipment) {
        throw new AppError(404, 'Romaneio não encontrado');
      }

      if (
        shipment.status !== ShipmentStatus.SEPARATING &&
        shipment.status !== ShipmentStatus.READY
      ) {
        throw new AppError(
          400,
          'Só é possível despachar um romaneio em SEPARAÇÃO ou PRONTO. ' +
            `Status atual: ${shipment.status}`
        );
      }

      const tasks = await tx.warehouseTask.findMany({
        where: {
          referenceType: SHIPMENT_TASK_REFERENCE_TYPE,
          reference: shipment.id,
        },
        select: { id: true, status: true },
      });

      const unfinished = tasks.filter(
        (task) => task.status !== WarehouseTaskStatus.COMPLETED
      );

      if (unfinished.length > 0) {
        throw new AppError(
          400,
          `Não é possível despachar: ${unfinished.length} de ${tasks.length} tarefa(s) ` +
            'de separação ainda não foram concluídas.'
        );
      }

      const dispatchedAt = new Date();

      // `pickedQty` e `shippedQty` avançam JUNTOS aqui, e não em dois momentos
      // diferentes, porque o gate acima já provou que tudo o que este romaneio
      // prometia foi efetivamente separado: no instante do despacho os dois
      // acumulados valem o mesmo para este romaneio.
      for (const item of shipment.items) {
        await tx.salesOrderItem.update({
          where: { id: item.salesOrderItemId },
          data: {
            pickedQty: { increment: item.quantity },
            shippedQty: { increment: item.quantity },
          },
        });
      }

      const updated = await tx.shipment.update({
        where: { id },
        data: { status: ShipmentStatus.DISPATCHED, dispatchedAt },
        include: shipmentInclude,
      });

      // O pedido só fecha quando TODOS os itens estiverem completos — é o que
      // permite o próximo romaneio parcial continuar de onde este parou.
      const orderItems = await tx.salesOrderItem.findMany({
        where: { orderId: shipment.salesOrderId },
        select: { quantity: true, shippedQty: true },
      });

      const fullyShipped = orderItems.every(
        (item) => item.shippedQty + QTY_EPSILON >= item.quantity
      );

      if (fullyShipped) {
        await tx.salesOrder.update({
          where: { id: shipment.salesOrderId },
          data: { status: SalesOrderStatus.SHIPPED },
        });
      }

      return {
        ...updated,
        salesOrderStatus: fullyShipped
          ? SalesOrderStatus.SHIPPED
          : (
              await tx.salesOrder.findUniqueOrThrow({
                where: { id: shipment.salesOrderId },
                select: { status: true },
              })
            ).status,
        pickingTasks: await listTasks(tx, id),
      };
    });
  }

  /**
   * Cancelamento só antes do despacho.
   *
   * As tarefas de separação AINDA ABERTAS do romaneio são canceladas na mesma
   * transação. Deixá-las de pé seria pior do que um registro órfão: um operador
   * concluiria depois a separação de um romaneio cancelado e o `applyMovement`
   * dessa conclusão debitaria estoque de verdade, para um documento que não
   * existe mais. Tarefa já COMPLETED fica como está — o material realmente saiu
   * do endereço, e apagar esse fato esconderia uma divergência que o inventário
   * precisa enxergar.
   */
  async cancel(id: string) {
    return prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.findUnique({ where: { id } });

      if (!shipment) {
        throw new AppError(404, 'Romaneio não encontrado');
      }

      if (shipment.status === ShipmentStatus.DISPATCHED) {
        throw new AppError(400, 'Não é possível cancelar um romaneio já despachado');
      }

      if (shipment.status === ShipmentStatus.CANCELLED) {
        throw new AppError(400, 'Romaneio já está cancelado');
      }

      await tx.warehouseTask.updateMany({
        where: {
          referenceType: SHIPMENT_TASK_REFERENCE_TYPE,
          reference: shipment.id,
          status: {
            in: [WarehouseTaskStatus.PENDING, WarehouseTaskStatus.IN_PROGRESS],
          },
        },
        data: { status: WarehouseTaskStatus.CANCELLED },
      });

      const updated = await tx.shipment.update({
        where: { id },
        data: { status: ShipmentStatus.CANCELLED },
        include: shipmentInclude,
      });

      return { ...updated, pickingTasks: await listTasks(tx, id) };
    });
  }
}

export default new ShipmentService();
