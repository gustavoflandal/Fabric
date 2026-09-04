import { describe, it, expect } from 'vitest'

// F-WORKFLOW — validateClientSide vive em um módulo separado
// (workflow-editor-validation.ts), testável isoladamente sem montar o
// <VueFlow> completo (que exigiria mockar useRoute/useVueFlow/ResizeObserver,
// fora do escopo desta task). A cobertura de fluxo completo fica para
// verificação manual/E2E, registrada no Final check do plano.

import { validateClientSide } from '../workflow-editor-validation'

describe('WorkflowTemplateEditorView — validateClientSide', () => {
  it('aceita um fluxo com Alocação e nenhuma decisão pendente', () => {
    const nodes = [
      { id: 'entry', type: 'entry', data: { workflowType: 'DESCARGA' } },
      { id: 'n2', type: 'operation', data: { workflowType: 'ALOCACAO' } },
    ]
    const edges = [{ id: 'e1', source: 'entry', target: 'n2' }]
    expect(validateClientSide(nodes as any, edges as any)).toEqual([])
  })

  it('rejeita nó de decisão sem duas saídas', () => {
    const nodes = [
      { id: 'entry', type: 'entry', data: { workflowType: 'DESCARGA' } },
      { id: 'n2', type: 'decision', data: { workflowType: 'DECISAO' } },
    ]
    const edges = [{ id: 'e1', source: 'entry', target: 'n2' }]
    const errors = validateClientSide(nodes as any, edges as any)
    expect(errors.some((e) => e.includes('duas saídas'))).toBe(true)
  })

  it('rejeita fluxo sem nenhum nó de Alocação', () => {
    const nodes = [{ id: 'entry', type: 'entry', data: { workflowType: 'DESCARGA' } }]
    const errors = validateClientSide(nodes as any, [])
    expect(errors.some((e) => e.includes('Alocação'))).toBe(true)
  })

  it('rejeita Alocação com conexão saindo', () => {
    const nodes = [
      { id: 'entry', type: 'entry', data: { workflowType: 'DESCARGA' } },
      { id: 'n2', type: 'operation', data: { workflowType: 'ALOCACAO' } },
      { id: 'n3', type: 'operation', data: { workflowType: 'DESCARGA' } },
    ]
    const edges = [
      { id: 'e1', source: 'entry', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
    ]
    const errors = validateClientSide(nodes as any, edges as any)
    expect(errors.some((e) => e.includes('Alocação não pode'))).toBe(true)
  })
})
