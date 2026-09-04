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
}

export type WarehouseTaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'

export interface WarehouseTaskAssignee {
  id: string
  name: string
  email: string
}

export interface WarehouseTask {
  id: string
  type: WarehouseTaskType
  status: WarehouseTaskStatus
  reference: string | null
  referenceType: string | null
  sequence: number | null
  assignedTo: string | null
  assignee: WarehouseTaskAssignee | null
  productId: string | null
  quantity: string | null
  fromPositionId: string | null
  toPositionId: string | null
  version: number
  createdAt: string
  startedAt: string | null
  completedAt: string | null
}

export interface ReceiptOperation {
  receiptId: string
  receiptNumber: string
  tasks: WarehouseTask[]
}

export type PanelScope = 'all' | 'mine'
