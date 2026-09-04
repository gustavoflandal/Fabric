export const CONDITION_FIELDS = [
  'product.weight',
  'product.volume',
  'product.packagingType',
  'product.segregationGroup',
  'product.maxStackQty',
  'product.lotTracked',
  'product.categoryId',
  'order.supplierId',
] as const

export type ConditionField = (typeof CONDITION_FIELDS)[number]
export type ConditionOperator = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains'

export interface ConditionLeaf {
  field: ConditionField
  operator: ConditionOperator
  value: string | number | boolean
}

export interface ConditionGroup {
  op: 'AND' | 'OR'
  clauses: ConditionRule[]
}

export type ConditionRule = ConditionLeaf | ConditionGroup

export const WORKFLOW_NODE_TYPES = [
  'DESCARGA',
  'CONFERENCIA',
  'ETIQUETAGEM',
  'QUARENTENA',
  'SEGREGACAO',
  'AMOSTRAGEM',
  'ALOCACAO',
  'DECISAO',
] as const

export type WorkflowNodeType = (typeof WORKFLOW_NODE_TYPES)[number]

export const WORKFLOW_NODE_LABELS: Record<WorkflowNodeType, string> = {
  DESCARGA: 'Descarga',
  CONFERENCIA: 'Conferência',
  ETIQUETAGEM: 'Etiquetagem',
  QUARENTENA: 'Quarentena',
  SEGREGACAO: 'Segregação',
  AMOSTRAGEM: 'Amostragem',
  ALOCACAO: 'Alocação',
  DECISAO: 'Decisão',
}

export interface WorkflowNode {
  id: string
  type: WorkflowNodeType
  label: string | null
  conditionRule: ConditionRule | null
  positionX: number
  positionY: number
}

export interface WorkflowEdge {
  id: string
  fromNodeId: string
  toNodeId: string
  branch: 'SIM' | 'NAO' | null
}

export interface WorkflowTemplate {
  id: string
  name: string
  description: string | null
  active: boolean
  priority: number
  triggerRule: ConditionRule | null
  entryNodeId: string | null
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  createdAt: string
  updatedAt: string
}

export interface WorkflowNodeDto {
  clientId: string
  type: WorkflowNodeType
  label?: string | null
  conditionRule?: ConditionRule | null
  positionX: number
  positionY: number
}

export interface WorkflowEdgeDto {
  fromClientId: string
  toClientId: string
  branch?: 'SIM' | 'NAO' | null
}

export interface WorkflowTemplateDto {
  name: string
  description?: string | null
  priority?: number
  active?: boolean
  triggerRule?: ConditionRule | null
  entryClientId: string
  nodes: WorkflowNodeDto[]
  edges: WorkflowEdgeDto[]
}
