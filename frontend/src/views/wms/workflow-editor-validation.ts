import type { WorkflowNodeType } from '@/types/workflow.types'

/**
 * F-WORKFLOW — forma mínima de nó/aresta exigida pela validação client-side,
 * extraída de `WorkflowTemplateEditorView.vue` para ser testável sem montar o
 * `<VueFlow>` inteiro. `data` é opcional aqui porque o tipo `Node` da lib
 * `@vue-flow/core` também o declara opcional (só `GraphNode`, o formato que
 * o `useVueFlow()` devolve depois de inicializado, o torna obrigatório).
 */
export interface ValidationFlowNode {
  id: string
  type?: string
  data?: {
    workflowType: WorkflowNodeType
  }
}

export interface ValidationFlowEdge {
  source: string
  target: string
}

/**
 * F-WORKFLOW — validação no CLIENTE, mesma checagem conceitual do backend
 * (workflow-graph.service.ts, Task 3), como feedback imediato antes de
 * chamar a API. A validação VINCULANTE continua sendo a do backend — este
 * bloco só evita uma viagem de rede num erro óbvio (ex: nó de decisão sem
 * duas saídas), mesmo padrão já usado no resto do sistema (ex: quantidade
 * pendente no recebimento).
 */
export function validateClientSide(nodes: ValidationFlowNode[], edges: ValidationFlowEdge[]): string[] {
  const errors: string[] = []
  const outgoingCount = new Map<string, number>()
  for (const edge of edges) {
    outgoingCount.set(edge.source, (outgoingCount.get(edge.source) ?? 0) + 1)
  }

  for (const node of nodes) {
    const outgoing = outgoingCount.get(node.id) ?? 0
    if (node.type === 'decision' && outgoing !== 2) {
      errors.push(`O nó de decisão "${node.id}" precisa de exatamente duas saídas (Sim e Não).`)
    }
    if (node.data?.workflowType === 'ALOCACAO' && outgoing > 0) {
      errors.push('O nó de Alocação não pode ter conexões saindo dele.')
    }
  }

  const hasAlocacao = nodes.some((n) => n.data?.workflowType === 'ALOCACAO')
  if (!hasAlocacao) {
    errors.push('O fluxo precisa ter um nó de Alocação — é o passo final obrigatório.')
  }

  return errors
}
