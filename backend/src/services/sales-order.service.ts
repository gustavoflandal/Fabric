import {
  Prisma,
  SalesOrderStatus,
  ShipmentStatus,
  WarehouseTaskStatus,
} from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { SEQUENCE_PREFIXES, nextDocumentNumber } from './document-sequence.service';
import { completedTasksBlockMessage } from './shipment.service';
import { SHIPMENT_TASK_REFERENCE_TYPE } from './warehouse-task.service';

/**
 * EXPEDIÇÃO — PEDIDO DE VENDA.
 *
 * Espelha estruturalmente `purchase-order.service.ts` (o documento mais
 * parecido do sistema, do outro lado do fluxo), com três diferenças
 * deliberadas:
 *
 *   1. `status` é um ENUM do Prisma (`SalesOrderStatus`), não uma `String` com
 *      os valores listados num comentário como em `PurchaseOrder`. O módulo é
 *      novo, então não há nada legado para preservar e o banco passa a recusar
 *      um status inválido em vez de confiar no service.
 *   2. NÃO existe `updateStatus(id, status)` público. Todo avanço de status
 *      passa por uma transição nomeada (`confirm`, `cancel`) ou pelo despacho
 *      do romaneio. Um setter genérico de status é exatamente o que permite
 *      pular DRAFT → SHIPPED sem nunca ter separado nada.
 *   3. `create` é `$transaction` pelo mesmo motivo que o de compras (F4.7): a
 *      sequência atômica precisa que o lock da linha dure até o COMMIT.
 */

export interface CreateSalesOrderDto {
  customerId: string;
  warehouseId: string;
  expectedShipDate?: string | Date | null;
  notes?: string | null;
  items: {
    productId: string;
    quantity: number;
    unitPrice: number;
  }[];
}

export interface UpdateSalesOrderDto {
  customerId?: string;
  warehouseId?: string;
  expectedShipDate?: string | Date | null;
  notes?: string | null;
  items?: {
    productId: string;
    quantity: number;
    unitPrice: number;
  }[];
}

export interface SalesOrderFilters {
  status?: string;
  customerId?: string;
  search?: string;
}

/**
 * `include` ÚNICO para detalhe e criação. Existe como constante para que o
 * shape da resposta não divirja entre as rotas — a Tarefa 4b (frontend) usa o
 * mesmo componente de detalhe para o retorno do `create` e o do `getById`.
 */
const orderInclude = {
  customer: { select: { id: true, code: true, name: true, document: true } },
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
    },
  },
  shipments: {
    select: {
      id: true,
      shipmentNumber: true,
      status: true,
      dispatchedAt: true,
      createdAt: true,
    },
  },
} satisfies Prisma.SalesOrderInclude;

/**
 * Mensagem única do bloqueio de cancelamento por romaneio JÁ DESPACHADO. Existe
 * como função porque `cancel()` a emite de DOIS pontos — o guard de leitura e a
 * divergência de contagem do `updateMany` que recusa `DISPATCHED` (correção de
 * revisão) —, e as duas são o mesmo problema visto em dois instantes.
 */
const dispatchedShipmentsBlockMessage = (count: number) =>
  `Não é possível cancelar: o pedido já tem ${count} romaneio(s) despachado(s). ` +
  'Cancele apenas os romaneios ainda não despachados.';

/**
 * Opções da transação de `cancel()`, que agora roda INTEIRA sob o
 * `SELECT ... FOR UPDATE` do pedido (correção de revisão) — mesmo raciocínio e
 * mesmos valores de `shipment.service.ts::TX_OPTIONS`: com o default do Prisma
 * (5s/2s), uma fila de requisições no mesmo pedido estoura como `P2028` e vira
 * 500 numa operação que só precisava aguardar o lock.
 */
const TX_OPTIONS = { timeout: 15000, maxWait: 5000 } as const;

const assertCustomerExists = async (customerId: string) => {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) throw new AppError(400, 'Cliente informado não existe');
};

const assertWarehouseExists = async (warehouseId: string) => {
  const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
  if (!warehouse) throw new AppError(400, 'Armazém informado não existe');
};

/**
 * Todo produto do payload tem de existir ANTES do `create`. Sem esta checagem o
 * erro viria do banco como violação de FK (P2003), que vira 500 genérico e não
 * diz ao usuário QUAL item está errado.
 */
const assertProductsExist = async (productIds: string[]) => {
  const unique = [...new Set(productIds)];
  const found = await prisma.product.findMany({
    where: { id: { in: unique } },
    select: { id: true },
  });

  if (found.length !== unique.length) {
    const foundIds = new Set(found.map((p) => p.id));
    const missing = unique.filter((id) => !foundIds.has(id));
    throw new AppError(400, `Produto(s) não encontrado(s): ${missing.join(', ')}`);
  }
};

const computeTotals = <T extends { quantity: number; unitPrice: number }>(items: T[]) => {
  const priced = items.map((item) => ({
    ...item,
    totalPrice: item.quantity * item.unitPrice,
  }));

  return {
    items: priced,
    totalValue: priced.reduce((sum, item) => sum + item.totalPrice, 0),
  };
};

export class SalesOrderService {
  async create(data: CreateSalesOrderDto, createdBy: string) {
    await assertCustomerExists(data.customerId);
    await assertWarehouseExists(data.warehouseId);
    await assertProductsExist(data.items.map((item) => item.productId));

    const { items, totalValue } = computeTotals(data.items);

    return prisma.$transaction(async (tx) => {
      // A sequência é o lock MAIS EXTERNO da transação (ver a nota de ordem de
      // lock em `document-sequence.service.ts`). Aqui é trivialmente respeitado:
      // nada mais nesta transação trava linha de outra tabela.
      const orderNumber = await nextDocumentNumber(tx, SEQUENCE_PREFIXES.SALES_ORDER);

      return tx.salesOrder.create({
        data: {
          orderNumber,
          customerId: data.customerId,
          warehouseId: data.warehouseId,
          status: SalesOrderStatus.DRAFT,
          expectedShipDate: data.expectedShipDate ? new Date(data.expectedShipDate) : null,
          totalValue,
          notes: data.notes || null,
          createdBy,
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
            })),
          },
        },
        include: orderInclude,
      });
    });
  }

  async getAll(page = 1, limit = 20, filters?: SalesOrderFilters) {
    const skip = (page - 1) * limit;
    const where: Prisma.SalesOrderWhereInput = {};

    if (filters?.status) {
      where.status = filters.status as SalesOrderStatus;
    }

    if (filters?.customerId) {
      where.customerId = filters.customerId;
    }

    // `search` cobre o número do pedido E o nome/código do cliente — é o que a
    // tela de lista oferece numa caixa só.
    if (filters?.search) {
      where.OR = [
        { orderNumber: { contains: filters.search } },
        { customer: { name: { contains: filters.search } } },
        { customer: { code: { contains: filters.search } } },
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.salesOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { orderDate: 'desc' },
        include: orderInclude,
      }),
      prisma.salesOrder.count({ where }),
    ]);

    return {
      data: orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string) {
    const order = await prisma.salesOrder.findUnique({
      where: { id },
      include: orderInclude,
    });

    if (!order) {
      throw new AppError(404, 'Pedido de venda não encontrado');
    }

    return order;
  }

  /**
   * Edição SÓ em DRAFT. Depois de CONFIRMED o pedido já pode ter romaneio
   * gerado e tarefa de separação criada a partir das quantidades — mudar um
   * item aqui deixaria a tarefa de armazém apontando para uma quantidade que o
   * pedido não pede mais, e ninguém replanejaria o picking.
   */
  async update(id: string, data: UpdateSalesOrderDto) {
    const order = await this.getById(id);

    if (order.status !== SalesOrderStatus.DRAFT) {
      throw new AppError(
        400,
        `Apenas pedidos em RASCUNHO podem ser editados. Status atual: ${order.status}`
      );
    }

    if (data.customerId) await assertCustomerExists(data.customerId);
    if (data.warehouseId) await assertWarehouseExists(data.warehouseId);
    if (data.items) await assertProductsExist(data.items.map((item) => item.productId));

    const recomputed = data.items ? computeTotals(data.items) : null;

    return prisma.$transaction(async (tx) => {
      // Substituição da lista inteira (mesmo contrato de compras): apaga e
      // recria dentro da MESMA transação, para que uma falha no `create` não
      // deixe o pedido sem item nenhum.
      if (recomputed) {
        await tx.salesOrderItem.deleteMany({ where: { orderId: id } });
      }

      return tx.salesOrder.update({
        where: { id },
        data: {
          customerId: data.customerId,
          warehouseId: data.warehouseId,
          expectedShipDate:
            data.expectedShipDate === undefined
              ? undefined
              : data.expectedShipDate === null
                ? null
                : new Date(data.expectedShipDate),
          notes: data.notes === undefined ? undefined : data.notes || null,
          totalValue: recomputed ? recomputed.totalValue : undefined,
          items: recomputed
            ? {
                create: recomputed.items.map((item) => ({
                  productId: item.productId,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  totalPrice: item.totalPrice,
                })),
              }
            : undefined,
        },
        include: orderInclude,
      });
    });
  }

  async confirm(id: string) {
    const order = await this.getById(id);

    if (order.status !== SalesOrderStatus.DRAFT) {
      throw new AppError(
        400,
        `Apenas pedidos em RASCUNHO podem ser confirmados. Status atual: ${order.status}`
      );
    }

    return prisma.salesOrder.update({
      where: { id },
      data: { status: SalesOrderStatus.CONFIRMED },
      include: orderInclude,
    });
  }

  /**
   * Cancelar é proibido depois de SHIPPED — o material já saiu fisicamente e
   * cancelar o documento não o traz de volta; a correção de um envio indevido é
   * uma devolução, que é outro processo.
   *
   * Romaneio já despachado com o pedido ainda parcialmente aberto também
   * bloqueia, pelo mesmo motivo: parte do material já saiu.
   *
   * CASCATA ATÉ A TAREFA DE ARMAZÉM, e é o ponto que faz este método valer uma
   * transação. Cancelar só o pedido deixaria de pé:
   *
   *   * romaneios PENDING/SEPARATING apontando para um pedido cancelado — que
   *     alguém separaria e despacharia, expedindo material de um pedido que não
   *     existe mais;
   *   * e, pior, as tarefas de `PICKING` desses romaneios, cuja conclusão
   *     DEBITA ESTOQUE DE VERDADE (`applyMovement`).
   *
   * Então o cancelamento desce os três níveis.
   *
   * TAREFA JÁ `COMPLETED` BLOQUEIA O CANCELAMENTO (correção de revisão, mesmo
   * critério e mesma mensagem de `shipment.service.ts::cancel()`). Uma tarefa
   * concluída já DEBITOU estoque de verdade: o material está fora do endereço,
   * separado na doca. Cancelar o pedido nesse estado apagaria o último
   * documento aberto que explica onde ele está, sem pedir o retorno — a falta
   * só apareceria na contagem. O caminho correto é registrar o retorno do
   * material ao endereço e só então cancelar.
   *
   * TUDO RODA DENTRO DA TRANSAÇÃO, SOB O MESMO LOCK DE PEDIDO QUE
   * `shipment.service.ts::create()` (correção de revisão). Antes, a releitura do
   * pedido e TODOS os guards — inclusive a montagem de `openShipmentIds` —
   * rodavam FORA de qualquer transação, e a cascata só alcançava os romaneios
   * que existiam naquele instante. Duas corridas reais saíam daí:
   *
   *   (a) contra `ShipmentService.create`: um romaneio criado ENTRE a leitura e
   *       o commit do cancelamento não entrava na cascata e ficava órfão — vivo
   *       em `PENDING`, apontando para um pedido `CANCELLED`, separável e
   *       despachável. É exatamente o que a cascata existe para impedir. O
   *       `SELECT ... FOR UPDATE` como PRIMEIRA instrução serializa os dois
   *       fluxos: ou o romaneio nasce antes e entra na cascata, ou nasce depois
   *       e é recusado pelo guard de status do `create`.
   *   (b) contra `ShipmentService.dispatch`: o `updateMany` de romaneios não
   *       filtrava status, então um romaneio que virasse `DISPATCHED` no meio do
   *       caminho (com `shippedQty` já incrementado) era sobrescrito para
   *       `CANCELLED` em silêncio. O lock do PEDIDO não cobre este caso —
   *       `dispatch` reivindica o romaneio sem tocar em `sales_orders` —, então
   *       os romaneios passam a ser lidos com `FOR UPDATE` também: o guard de
   *       "romaneio já despachado" enxerga o último commit e nenhum despacho
   *       consegue entrar depois disso. O `updateMany` ainda filtra
   *       `not: DISPATCHED` como segunda trava, e a divergência de contagem
   *       relança o mesmo guard em vez de ignorar.
   *
   * O LOCK É A PRIMEIRA INSTRUÇÃO pelo mesmo motivo documentado em
   * `shipment.service.ts::create()`: em MySQL REPEATABLE READ o snapshot de
   * leitura consistente nasce na primeira leitura NÃO-travante da transação, e
   * `FOR UPDATE` não cria snapshot — lê sempre o último commit. Se a releitura
   * do pedido viesse antes do lock, ele existiria e ainda assim os guards
   * leriam dado velho.
   */
  async cancel(id: string) {
    return prisma.$transaction(async (tx) => {
      // O LOCK. Mesma linha e mesma ordem de `ShipmentService.create` — é o que
      // faz os dois fluxos se enfileirarem em vez de se cruzarem.
      await tx.$executeRaw`SELECT id FROM sales_orders WHERE id = ${id} FOR UPDATE`;

      const order = await tx.salesOrder.findUnique({
        where: { id },
        select: { status: true },
      });

      if (!order) {
        throw new AppError(404, 'Pedido de venda não encontrado');
      }

      if (order.status === SalesOrderStatus.SHIPPED) {
        throw new AppError(400, 'Não é possível cancelar um pedido já expedido');
      }

      if (order.status === SalesOrderStatus.CANCELLED) {
        throw new AppError(400, 'Pedido já está cancelado');
      }

      // OS ROMANEIOS TAMBÉM SÃO LIDOS TRAVANDO. O lock do PEDIDO ordena este
      // cancelamento contra `ShipmentService.create` (cenário (a)), mas não
      // contra `dispatch`, que nem toca em `sales_orders` antes de reivindicar
      // o romaneio: um despacho que commitasse depois do snapshot desta
      // transação nascer ficaria invisível para os guards abaixo, que é o
      // cenário (b). `FOR UPDATE` resolve os dois lados de uma vez — não lê
      // snapshot (vê o último commit) e segura a linha, então nenhum `dispatch`
      // consegue reivindicar estes romaneios até este cancelamento commitar ou
      // fazer rollback.
      const shipments = await tx.$queryRaw<{ id: string; status: ShipmentStatus }[]>`
        SELECT id, status FROM shipments WHERE salesOrderId = ${id} FOR UPDATE
      `;

      const dispatched = shipments.filter(
        (shipment) => shipment.status === ShipmentStatus.DISPATCHED
      );
      if (dispatched.length > 0) {
        throw new AppError(400, dispatchedShipmentsBlockMessage(dispatched.length));
      }

      const openShipmentIds = shipments
        .filter((shipment) => shipment.status !== ShipmentStatus.CANCELLED)
        .map((shipment) => shipment.id);

      if (openShipmentIds.length > 0) {
        // O bloqueio vem ANTES de qualquer escrita: se houver material já
        // separado (tarefa COMPLETED), nada é cancelado.
        const completed = await tx.warehouseTask.count({
          where: {
            referenceType: SHIPMENT_TASK_REFERENCE_TYPE,
            reference: { in: openShipmentIds },
            status: WarehouseTaskStatus.COMPLETED,
          },
        });

        if (completed > 0) {
          throw new AppError(400, completedTasksBlockMessage(completed));
        }

        await tx.warehouseTask.updateMany({
          where: {
            referenceType: SHIPMENT_TASK_REFERENCE_TYPE,
            reference: { in: openShipmentIds },
            status: {
              in: [WarehouseTaskStatus.PENDING, WarehouseTaskStatus.IN_PROGRESS],
            },
          },
          data: { status: WarehouseTaskStatus.CANCELLED },
        });

        // `not: DISPATCHED` é a segunda trava do cenário (b), agora explícita
        // na própria escrita: um romaneio despachado NUNCA é sobrescrito para
        // `CANCELLED`, aconteça o que acontecer com a leitura.
        const cancelled = await tx.shipment.updateMany({
          where: {
            id: { in: openShipmentIds },
            status: { not: ShipmentStatus.DISPATCHED },
          },
          data: { status: ShipmentStatus.CANCELLED },
        });

        if (cancelled.count !== openShipmentIds.length) {
          // REDE DE SEGURANÇA. Com a leitura travante acima isto não deveria
          // acontecer — nenhum romaneio deste pedido muda de status enquanto
          // esta transação segura as linhas. Se acontecer mesmo assim, é porque
          // algum romaneio foi despachado por fora deste caminho: o `throw`
          // desfaz tudo (nada de pedido cancelado pela metade) e a mensagem é a
          // mesma do guard de cima, porque é o mesmo problema físico.
          throw new AppError(
            400,
            dispatchedShipmentsBlockMessage(openShipmentIds.length - cancelled.count)
          );
        }
      }

      return tx.salesOrder.update({
        where: { id },
        data: { status: SalesOrderStatus.CANCELLED },
        include: orderInclude,
      });
    }, TX_OPTIONS);
  }

  /**
   * Exclusão só de DRAFT e sem romaneio — mesmo critério de
   * `purchase-order.service.ts::delete()` (que recusa pedido com recebimento).
   * Os itens somem em cascata pela FK; o romaneio NÃO cascateia de propósito
   * (`Shipment.salesOrderId` é `Restrict`), então a checagem aqui é o que
   * impede o `delete` de estourar como erro de banco.
   */
  async delete(id: string) {
    const order = await this.getById(id);

    if (order.status !== SalesOrderStatus.DRAFT) {
      throw new AppError(
        400,
        `Apenas pedidos em RASCUNHO podem ser excluídos. Status atual: ${order.status}`
      );
    }

    if (order.shipments.length > 0) {
      throw new AppError(400, 'Não é possível excluir um pedido que já tem romaneios');
    }

    await prisma.salesOrder.delete({ where: { id } });
  }
}

export default new SalesOrderService();
