import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

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

// F-WORKFLOW-FIX1 — regressão para o bug crítico da revisão final: editar um
// template EXISTENTE sempre falhava com HTTP 400 ("Nó de entrada não existe
// no fluxo") porque handleSave enviava `entryClientId: 'entry'` (string fixa)
// mesmo no modo edição, onde o nó de entrada carregado do backend tem seu
// UUID PERSISTIDO como id — nenhum nó no payload tinha `clientId: 'entry'`.
// Diferente do teste de ciclo de vida do backend (workflow-template.test.ts),
// que sempre usa client ids frescos (c1/c2) e por isso nunca reproduz esse
// bug, este teste monta a view INTEIRA no modo edição, deixa `getTemplateById`
// resolver com um template cujo `entryNodeId` é um uuid persistido, aciona
// Salvar e verifica que o DTO passado a `updateTemplate` carrega esse uuid —
// não a string 'entry'. `@vue-flow/core` é mockado (a lib real dispara
// medições via ResizeObserver, indisponível no jsdom sem polyfill) — o que
// importa aqui é o fluxo de dados de handleSave, não a renderização do canvas.
const mocks = vi.hoisted(() => ({
  getTemplateById: vi.fn(),
  createTemplate: vi.fn(),
  updateTemplate: vi.fn(),
  push: vi.fn(),
}))

vi.mock('vue-router', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    useRoute: () => ({ params: { id: 'tpl-uuid-1' } }),
    useRouter: () => ({ push: mocks.push }),
    RouterLink: defineComponent({
      props: { to: { type: [String, Object], required: true } },
      setup: (props, { slots }) => () => h('a', { href: String(props.to) }, slots.default?.()),
    }),
  }
})

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ userName: 'Gustavo', logout: vi.fn() }),
}))

vi.mock('@/stores/workflow-template.store', () => ({
  useWorkflowTemplateStore: () => ({
    getTemplateById: mocks.getTemplateById,
    createTemplate: mocks.createTemplate,
    updateTemplate: mocks.updateTemplate,
  }),
}))

vi.mock('@vue-flow/core', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    VueFlow: defineComponent({
      props: ['nodes', 'edges'],
      emits: ['update:nodes', 'update:edges', 'connect', 'node-click'],
      setup: (_props, { slots }) => () => h('div', slots.default ? slots.default() : []),
    }),
    useVueFlow: () => ({
      project: (pos: { x: number; y: number }) => pos,
      findNode: () => undefined,
    }),
    Handle: defineComponent({ setup: () => () => null }),
    Position: { Left: 'left', Right: 'right', Top: 'top', Bottom: 'bottom' },
  }
})

import WorkflowTemplateEditorView from '../WorkflowTemplateEditorView.vue'

describe('WorkflowTemplateEditorView — handleSave no modo edição (Fix 1)', () => {
  beforeEach(() => {
    mocks.getTemplateById.mockReset()
    mocks.createTemplate.mockReset()
    mocks.updateTemplate.mockReset()
    mocks.push.mockReset()
  })

  it('envia o uuid PERSISTIDO do nó de entrada como entryClientId, não a string "entry"', async () => {
    mocks.getTemplateById.mockResolvedValue({
      id: 'tpl-uuid-1',
      name: 'Fluxo padrão',
      description: 'Descrição existente',
      active: true,
      priority: 0,
      triggerRule: null,
      entryNodeId: 'entry-uuid-999',
      nodes: [
        { id: 'entry-uuid-999', type: 'DESCARGA', label: null, conditionRule: null, positionX: 0, positionY: 0 },
        { id: 'aloc-uuid-1', type: 'ALOCACAO', label: null, conditionRule: null, positionX: 200, positionY: 0 },
      ],
      edges: [{ id: 'edge-1', fromNodeId: 'entry-uuid-999', toNodeId: 'aloc-uuid-1', branch: null }],
      createdAt: '',
      updatedAt: '',
    })
    mocks.updateTemplate.mockResolvedValue({})

    const wrapper = mount(WorkflowTemplateEditorView)
    await flushPromises()

    const salvar = wrapper.findAll('button').find((b) => b.text().trim() === 'Salvar')!
    await salvar.trigger('click')
    await flushPromises()

    expect(mocks.updateTemplate).toHaveBeenCalledTimes(1)
    const [id, dto] = mocks.updateTemplate.mock.calls[0]
    expect(id).toBe('tpl-uuid-1')
    expect(dto.entryClientId).toBe('entry-uuid-999')
    expect(dto.entryClientId).not.toBe('entry')
    // Fix 2, de brinde: a descrição carregada não deve ser silenciosamente
    // apagada ao salvar.
    expect(dto.description).toBe('Descrição existente')
  })
})
