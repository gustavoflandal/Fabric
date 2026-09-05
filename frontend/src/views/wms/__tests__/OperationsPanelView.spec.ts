import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import OperationsPanelView from '../OperationsPanelView.vue'
import warehouseTaskService from '@/services/warehouse-task.service'
import purchaseReceiptService from '@/services/purchase-receipt.service'

// AppLayout usa RouterLink/useRouter, e a própria view usa useRoute/useRouter —
// mesmo padrão de mock de vue-router já usado em AppLayout.spec.ts.
vi.mock('vue-router', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    useRoute: () => ({ query: {} }),
    useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
    RouterLink: defineComponent({
      props: { to: { type: [String, Object], required: true } },
      setup: (props, { slots }) => () => h('a', { href: String(props.to) }, slots.default?.()),
    }),
  }
})

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({
    user: { id: 'me', email: 'me@fabric.test', name: 'Operador' },
    userName: 'Operador',
    logout: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('@/services/warehouse-task.service', () => ({
  default: { getPanel: vi.fn(), start: vi.fn(), complete: vi.fn(), putaway: vi.fn() },
}))

vi.mock('@/services/purchase-receipt.service', () => ({
  default: { getById: vi.fn() },
}))

// Tarefa livre (assignedTo: null) — primeira não resolvida da cadeia, então
// computeTaskRectangleState resolve para 'active-mine' e o clique abre o
// diálogo de confirmação "Pegar esta tarefa?" em vez de ir direto para openAction.
const freeTask = {
  id: 't1',
  type: 'DESCARGA' as const,
  status: 'PENDING' as const,
  reference: 'r1',
  referenceType: 'PURCHASE_RECEIPT',
  sequence: 1,
  assignedTo: null,
  assignee: null,
  productId: null,
  quantity: null,
  fromPositionId: null,
  toPositionId: null,
  version: 0,
  createdAt: '',
  startedAt: null,
  completedAt: null,
}

// Tarefa já atribuída ao usuário atual ('me') — clique vai direto para openAction.
const ownedTask = {
  id: 't2',
  type: 'CONFERENCIA' as const,
  status: 'IN_PROGRESS' as const,
  reference: 'r2',
  referenceType: 'PURCHASE_RECEIPT',
  sequence: 1,
  assignedTo: 'me',
  assignee: { id: 'me', name: 'Operador', email: 'me@fabric.test' },
  productId: null,
  quantity: null,
  fromPositionId: null,
  toPositionId: null,
  version: 0,
  createdAt: '',
  startedAt: null,
  completedAt: null,
}

function findButtonByText(root: ParentNode, text: string): HTMLButtonElement {
  const button = Array.from(root.querySelectorAll('button')).find((b) => b.textContent?.includes(text))
  if (!button) throw new Error(`Botão contendo "${text}" não encontrado`)
  return button as HTMLButtonElement
}

describe('OperationsPanelView', () => {
  let wrapper: VueWrapper | null = null

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    document.body.innerHTML = ''
  })

  afterEach(() => {
    // A view registra setInterval(load, ...) em onMounted — desmontar evita
    // que o timer sobreviva entre testes chamando serviços já resetados.
    wrapper?.unmount()
    wrapper = null
  })

  it('erro em warehouseTaskService.start durante confirmPickup mostra mensagem no diálogo e não abre o modal de ação', async () => {
    vi.mocked(warehouseTaskService.getPanel).mockResolvedValue({
      data: { status: 'success', data: [{ receiptId: 'rec1', receiptNumber: 'REC-2026-0001', tasks: [freeTask] }] },
    } as any)

    wrapper = mount(OperationsPanelView, { attachTo: document.body })
    await flushPromises()

    const taskButton = findButtonByText(wrapper!.element, 'Descarga')
    taskButton.click()
    await wrapper!.vm.$nextTick()

    // Diálogo de confirmação "pegar tarefa" aberto (Teleport para document.body).
    expect(document.body.textContent).toContain('Pegar esta tarefa?')

    vi.mocked(warehouseTaskService.start).mockRejectedValue({
      response: { data: { message: 'Esta tarefa já está atribuída a outro operador.' } },
    })

    const confirmButton = findButtonByText(document.body, 'Pegar tarefa')
    confirmButton.click()
    await flushPromises()

    expect(warehouseTaskService.start).toHaveBeenCalledWith('t1')
    expect(document.body.textContent).toContain('Esta tarefa já está atribuída a outro operador.')

    // Diálogo continua aberto — não fechou nem avançou para o modal de ação.
    expect(document.body.textContent).toContain('Pegar esta tarefa?')
    expect(purchaseReceiptService.getById).not.toHaveBeenCalled()
    expect(document.body.textContent).not.toContain('Conduzir etapa')
  })

  it('erro em purchaseReceiptService.getById durante openAction mostra erro visível e não abre nenhum modal de ação', async () => {
    vi.mocked(warehouseTaskService.getPanel).mockResolvedValue({
      data: { status: 'success', data: [{ receiptId: 'rec2', receiptNumber: 'REC-2026-0002', tasks: [ownedTask] }] },
    } as any)
    vi.mocked(purchaseReceiptService.getById).mockRejectedValue({
      response: { data: { message: 'Recebimento não encontrado.' } },
    })

    wrapper = mount(OperationsPanelView, { attachTo: document.body })
    await flushPromises()

    const taskButton = findButtonByText(wrapper!.element, 'Conferência')
    taskButton.click()
    await flushPromises()

    expect(purchaseReceiptService.getById).toHaveBeenCalledWith('rec2')

    // Erro visível via store.error (banner já existente na view).
    expect(wrapper!.text()).toContain('Não foi possível carregar os detalhes do recebimento.')
    expect(wrapper!.text()).toContain('Recebimento não encontrado.')

    // Nenhum modal de ação foi aberto.
    expect(document.body.textContent).not.toContain('Conduzir etapa')
    expect(document.body.textContent).not.toContain('Alocação')
  })
})
