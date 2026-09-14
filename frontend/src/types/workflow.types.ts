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

/** Rótulo amigável de cada campo condicional — sem isto o construtor de
 * regras do workflow mostrava o caminho técnico cru (`product.weight`) em vez
 * de um texto legível para quem está configurando a regra. */
export const CONDITION_FIELD_LABELS: Record<ConditionField, string> = {
  'product.weight': 'Peso do produto',
  'product.volume': 'Volume do produto',
  'product.packagingType': 'Tipo de embalagem',
  'product.segregationGroup': 'Grupo de segregação',
  'product.maxStackQty': 'Qtd. máxima de empilhamento',
  'product.lotTracked': 'Produto controla lote',
  'product.categoryId': 'Categoria do produto',
  'order.supplierId': 'Fornecedor do pedido',
}

/** Rótulo amigável de cada operador — mesmo motivo do mapa acima. */
export const CONDITION_OPERATOR_LABELS: Record<ConditionOperator, string> = {
  eq: 'Igual a',
  ne: 'Diferente de',
  gt: 'Maior que',
  gte: 'Maior ou igual a',
  lt: 'Menor que',
  lte: 'Menor ou igual a',
  contains: 'Contém',
}

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
