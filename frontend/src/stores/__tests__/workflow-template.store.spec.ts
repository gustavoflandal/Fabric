import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWorkflowTemplateStore } from '../workflow-template.store'
import workflowTemplateService from '@/services/workflow-template.service'

vi.mock('@/services/workflow-template.service', () => ({
  default: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    duplicate: vi.fn(),
  },
}))

const mockTemplate = {
  id: 't1',
  name: 'Fluxo teste',
  description: null,
  active: true,
  priority: 0,
  triggerRule: null,
  entryNodeId: 'n1',
  nodes: [],
  edges: [],
  createdAt: '',
  updatedAt: '',
}

describe('useWorkflowTemplateStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('fetchTemplates popula templates a partir do service', async () => {
    vi.mocked(workflowTemplateService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockTemplate] },
    } as any)

    const store = useWorkflowTemplateStore()
    await store.fetchTemplates()

    expect(store.templates).toEqual([mockTemplate])
  })

  it('createTemplate adiciona o template criado à lista', async () => {
    vi.mocked(workflowTemplateService.create).mockResolvedValue({
      data: { status: 'success', data: mockTemplate },
    } as any)

    const store = useWorkflowTemplateStore()
    await store.createTemplate({ name: 'x', entryClientId: 'c1', nodes: [], edges: [] })

    expect(store.templates).toContainEqual(mockTemplate)
  })

  it('deleteTemplate remove o template da lista', async () => {
    vi.mocked(workflowTemplateService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockTemplate] },
    } as any)
    vi.mocked(workflowTemplateService.delete).mockResolvedValue({ data: { status: 'success' } } as any)

    const store = useWorkflowTemplateStore()
    await store.fetchTemplates()
    await store.deleteTemplate('t1')

    expect(store.templates).toEqual([])
  })
})
