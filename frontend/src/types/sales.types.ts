/**
 * Tipos do módulo EXPEDIÇÃO (Pedido de Venda + Romaneio).
 *
 * Espelham o schema Prisma (`sales_orders`, `sales_order_items`, `shipments`,
 * `shipment_items`) E o shape que os controllers realmente devolvem — os
 * `include` constantes de `sales-order.service.ts::orderInclude` e
 * `shipment.service.ts::shipmentInclude`. Os campos de relação são OPCIONAIS
 * aqui (e não só nuláveis) porque nem todo endpoint os expande.
 *
 * Os dois documentos vivem no MESMO arquivo de propósito: `Shipment` referencia
 * `SalesOrderStatus` e `ShipmentStatus` aparece no resumo de romaneios embutido
 * no pedido — separá-los criaria uma dependência circular entre dois módulos de
 * tipos para nenhum ganho.
 */

import type {
  WarehouseTaskAssignee,
  WarehouseTaskLotRef,
  WarehouseTaskPositionRef,
  WarehouseTaskProductRef,
  WarehouseTaskStatus,
  WarehouseTaskType,
} from './warehouse-task.types';

/* -------------------------------------------------------------------------- */
/* Status                                                                     */
/* -------------------------------------------------------------------------- */

/** `enum SalesOrderStatus` do Prisma, na mesma ordem do ciclo de vida. */
export const SALES_ORDER_STATUSES = [
  'DRAFT',
  'CONFIRMED',
  'SEPARATING',
  'READY_TO_SHIP',
  'SHIPPED',
  'CANCELLED',
] as const;

export type SalesOrderStatus = (typeof SALES_ORDER_STATUSES)[number];

export const SALES_ORDER_STATUS_LABELS: Record<SalesOrderStatus, string> = {
  DRAFT: 'Rascunho',
  CONFIRMED: 'Confirmado',
  SEPARATING: 'Em separação',
  READY_TO_SHIP: 'Pronto para expedir',
  SHIPPED: 'Expedido',
  CANCELLED: 'Cancelado',
};

/** `enum ShipmentStatus` do Prisma. */
export const SHIPMENT_STATUSES = [
  'PENDING',
  'SEPARATING',
  'READY',
  'DISPATCHED',
  'CANCELLED',
] as const;

export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  PENDING: 'Pendente',
  SEPARATING: 'Em separação',
  READY: 'Pronto',
  DISPATCHED: 'Despachado',
  CANCELLED: 'Cancelado',
};

/**
 * Status de pedido a partir dos quais o backend aceita criar um romaneio
 * (`shipment.service.ts::create`). SEPARATING está incluído porque a expedição
 * é PARCIAL: um segundo romaneio pode nascer com o pedido já em separação.
 */
export const SHIPPABLE_SALES_ORDER_STATUSES: SalesOrderStatus[] = ['CONFIRMED', 'SEPARATING'];

/* -------------------------------------------------------------------------- */
/* Relações expandidas pelos `include` do backend                             */
/* -------------------------------------------------------------------------- */

export interface SalesCustomerRef {
  id: string;
  code: string;
  name: string;
  document?: string | null;
}

export interface SalesWarehouseRef {
  id: string;
  code: string;
  name: string;
}

export interface SalesUserRef {
  id: string;
  name: string;
  email: string;
}

export interface SalesProductRef {
  id: string;
  code: string;
  name: string;
  lotTracked: boolean;
  unit?: { id: string; code: string; symbol: string } | null;
}

export interface SalesLotRef {
  id: string;
  lotNumber: string;
  expiresAt: string | null;
}

/* -------------------------------------------------------------------------- */
/* Pedido de Venda                                                            */
/* -------------------------------------------------------------------------- */

export interface SalesOrderItem {
  id: string;
  orderId: string;
  productId: string;
  /** `Float` (DOUBLE) no banco — número, não string como os `Decimal` do WMS. */
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  /** Acumulados que só crescem; o pedido fecha quando `shippedQty >= quantity` em todos os itens. */
  pickedQty: number;
  shippedQty: number;
  product?: SalesProductRef;
}

/** Resumo de romaneio embutido no pedido (`orderInclude.shipments`, que é um `select`). */
export interface SalesOrderShipmentSummary {
  id: string;
  shipmentNumber: string;
  status: ShipmentStatus;
  dispatchedAt: string | null;
  createdAt: string;
}

export interface SalesOrder {
  id: string;
  /** `PV-{ano}-{seq}`, emitido pela sequência atômica do backend — nunca enviado pelo cliente. */
  orderNumber: string;
  customerId: string;
  warehouseId: string;
  status: SalesOrderStatus;
  orderDate: string;
  expectedShipDate: string | null;
  totalValue: number;
  notes: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  customer?: SalesCustomerRef;
  warehouse?: SalesWarehouseRef;
  creator?: SalesUserRef;
  items: SalesOrderItem[];
  shipments?: SalesOrderShipmentSummary[];
}

export interface SalesOrderItemInput {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface CreateSalesOrderDto {
  customerId: string;
  warehouseId: string;
  expectedShipDate?: string | null;
  notes?: string | null;
  items: SalesOrderItemInput[];
}

/**
 * `items` é opcional: omitir mantém a lista atual, enviar SUBSTITUI a lista
 * inteira (mesmo contrato de `purchase-order`). Edição só é aceita em DRAFT.
 */
export interface UpdateSalesOrderDto {
  customerId?: string;
  warehouseId?: string;
  expectedShipDate?: string | null;
  notes?: string | null;
  items?: SalesOrderItemInput[];
}

export interface SalesOrderFilters {
  status?: string;
  customerId?: string;
  search?: string;
}

/* -------------------------------------------------------------------------- */
/* Romaneio                                                                   */
/* -------------------------------------------------------------------------- */

export interface ShipmentItem {
  id: string;
  shipmentId: string;
  salesOrderItemId: string;
  productId: string;
  quantity: number;
  /** Nasce nulo: o lote só é escolhido pelo FEFO na separação. */
  lotId: string | null;
  product?: SalesProductRef;
  salesOrderItem?: {
    id: string;
    quantity: number;
    pickedQty: number;
    shippedQty: number;
  };
  lot?: SalesLotRef | null;
}

/** Pedido embutido no romaneio (`shipmentInclude.salesOrder`, um `select` reduzido). */
export interface ShipmentSalesOrderRef {
  id: string;
  orderNumber: string;
  status: SalesOrderStatus;
  customer?: SalesCustomerRef;
}

/**
 * Tarefa de separação de um romaneio, exatamente no `select` de
 * `shipment.service.ts::listTasks` — que é um SUBCONJUNTO de `WarehouseTask`
 * (sem `reference`/`referenceType`/`sequence`/`toPosition`). Tipo próprio em vez
 * de `WarehouseTask` para que o compilador não deixe ler campo que a resposta
 * não traz; as referências (produto/lote/posição/responsável) são reaproveitadas
 * de `warehouse-task.types.ts` porque o `select` é literalmente o mesmo.
 */
// `type` e não `interface`: ao declarar como `interface` durante o
// desenvolvimento, o `item` do slot `#row` do `DataTable` (genérico sobre
// `T extends Record<string, unknown>`) degradava para `{}`. Note que
// `SalesOrder`/`Shipment` abaixo SÃO `interface` e passam pelo mesmo
// `DataTable` sem esse problema — a causa exata não está confirmada (não é a
// regra geral "interface nunca satisfaz Record" que a versão anterior deste
// comentário afirmava); manter como `type` aqui por ser a forma já testada.
export type ShipmentPickingTask = {
  id: string;
  type: WarehouseTaskType;
  status: WarehouseTaskStatus;
  productId: string | null;
  lotId: string | null;
  /** `Decimal(18,4)` serializado como STRING pelo backend (decisão D2 do WMS). */
  quantity: string | null;
  fromPositionId: string | null;
  priority: number;
  assignedTo: string | null;
  version: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  product?: WarehouseTaskProductRef | null;
  lot?: WarehouseTaskLotRef | null;
  fromPosition?: WarehouseTaskPositionRef | null;
  assignee?: WarehouseTaskAssignee | null;
};

export interface Shipment {
  id: string;
  /** `EXP-{ano}-{seq}`, emitido pela sequência atômica do backend. */
  shipmentNumber: string;
  salesOrderId: string;
  /** HERDADO do pedido — o backend recusa `warehouseId` no payload de criação. */
  warehouseId: string;
  status: ShipmentStatus;
  dispatchedAt: string | null;
  notes: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  salesOrder?: ShipmentSalesOrderRef;
  warehouse?: SalesWarehouseRef;
  creator?: SalesUserRef;
  items: ShipmentItem[];
  /**
   * Só vem no DETALHE e nas transições (`getById`, `startSeparation`,
   * `dispatch`, `cancel`) — a listagem (`getAll`) não embute tarefas.
   */
  pickingTasks?: ShipmentPickingTask[];
  /** Só no retorno de `dispatch`: como o pedido ficou depois do despacho. */
  salesOrderStatus?: SalesOrderStatus;
}

export interface CreateShipmentItemInput {
  salesOrderItemId: string;
  quantity: number;
}

export interface CreateShipmentDto {
  salesOrderId: string;
  notes?: string | null;
  items: CreateShipmentItemInput[];
}

export interface ShipmentFilters {
  status?: string;
  salesOrderId?: string;
  warehouseId?: string;
}
