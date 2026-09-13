// Os 7 tipos do motor de workflow dinâmico (PR #9). SEGREGACAO/AMOSTRAGEM
// ainda não existem no enum do backend deste branch (só depois do PR #9
// mesclar) — mantidos aqui porque é um superconjunto seguro: nenhuma tarefa
// real hoje tem esses dois tipos, então nunca há mismatch com o que a API
// atual devolve, e o frontend já nasce pronto para quando o PR #9 mesclar.
export const WAREHOUSE_TASK_TYPES = [
  'DESCARGA',
  'CONFERENCIA',
  'ETIQUETAGEM',
  'QUARENTENA',
  'SEGREGACAO',
  'AMOSTRAGEM',
  'ALOCACAO',
  // Fase 4b/5 (F4.8/F4.10) — tipos do fluxo de SAÍDA (separação/reposição), já
  // existentes no enum Prisma (schema.prisma linha ~1594). O frontend estava
  // desatualizado; nenhuma mudança de backend foi necessária para isto.
  'PICKING',
  'REPLENISHMENT',
] as const

export type WarehouseTaskType = (typeof WAREHOUSE_TASK_TYPES)[number]

export const WAREHOUSE_TASK_TYPE_LABELS: Record<WarehouseTaskType, string> = {
  DESCARGA: 'Descarga',
  CONFERENCIA: 'Conferência',
  ETIQUETAGEM: 'Etiquetagem',
  QUARENTENA: 'Quarentena',
  SEGREGACAO: 'Segregação',
  AMOSTRAGEM: 'Amostragem',
  ALOCACAO: 'Alocação',
  PICKING: 'Separação',
  REPLENISHMENT: 'Reposição',
}

export type WarehouseTaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'

export interface WarehouseTaskAssignee {
  id: string
  name: string
  email?: string
}

export interface WarehouseTaskProductRef {
  id: string
  code: string
  name: string
}

// Fase 5 — o lote que a tarefa movimenta (FEFO no picking). `null`/ausente
// para produto sem `lotTracked`.
export interface WarehouseTaskLotRef {
  id: string
  lotNumber: string
  expiresAt: string | null
}

export interface WarehouseTaskPositionRef {
  id: string
  code: string
}

export interface WarehouseTask {
  id: string
  type: WarehouseTaskType
  status: WarehouseTaskStatus
  reference: string | null
  referenceType: string | null
  sequence: number | null
  // F4.8/F4.10 — urgência declarada da tarefa (DESC na fila de `GET /my`).
  priority: number
  assignedTo: string | null
  // NEM TODO endpoint que devolve `WarehouseTask` inclui a relação `assignee`
  // (ex.: `GET /warehouse-tasks/my` hoje não a seleciona) — por isso opcional,
  // e não apenas nullable. Ver a nota em `PickingView.vue::responsavelLabel`.
  assignee?: WarehouseTaskAssignee | null
  productId: string | null
  product?: WarehouseTaskProductRef | null
  lotId: string | null
  lot?: WarehouseTaskLotRef | null
  // `Decimal(18,4)` serializado como STRING pelo backend (decisão D2) — nunca
  // `number` na borda, para não perder precisão.
  quantity: string | null
  fromPositionId: string | null
  fromPosition?: WarehouseTaskPositionRef | null
  toPositionId: string | null
  toPosition?: WarehouseTaskPositionRef | null
  version: number
  createdAt: string
  startedAt: string | null
  completedAt: string | null
}

// F4.11 — resposta de `POST /warehouse-tasks/:id/scan`. Sempre HTTP 200,
// mesmo com `ok: false` (ver a nota completa em `warehouse-task.service.ts`
// do backend, `scanTask`).
export interface WarehouseTaskScanResult {
  taskId: string
  code: string
  match: 'POSITION' | 'PRODUCT' | null
  ok: boolean
  message: string
  expected: { position: string | null; product: string | null }
}

export interface ReceiptOperation {
  receiptId: string
  receiptNumber: string
  tasks: WarehouseTask[]
}

export type PanelScope = 'all' | 'mine'
