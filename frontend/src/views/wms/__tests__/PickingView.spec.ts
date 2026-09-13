import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { setActivePinia, createPinia } from 'pinia'
import PickingView from '../PickingView.vue'
import warehouseTaskService from '@/services/warehouse-task.service'
import { useToast } from '@/composables/useToast'
import type { WarehouseTask } from '@/types/warehouse-task.types'

vi.mock('@/services/warehouse-task.service', () => ({
  default: {
    getMyTasks: vi.fn(),
    start: vi.fn(),
    execute: vi.fn(),
    assign: vi.fn(),
    scan: vi.fn(),
  },
}))

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ user: { id: 'user-me', name: 'Operador Teste', email: 't@t.com' }, userName: 'Operador Teste', logout: vi.fn() }),
}))
vi.mock('@/stores/theme.store', () => ({
  useThemeStore: () => ({ mode: 'system', isDark: false, setMode: vi.fn() }),
}))

// `confirmDialog` é baseado em Promise e depende de um `<ConfirmDialogContainer />`
// montado em App.vue (fora do escopo deste teste) — mockado para resolver `true`
// direto, mesmo padrão de StockTransferView.spec.ts.
vi.mock('@/composables/useConfirm', () => ({
  confirmDialog: vi.fn().mockResolvedValue(true),
}))

function makeTask(overrides: Partial<WarehouseTask> = {}): WarehouseTask {
  return {
    id: 'task-1',
    type: 'PICKING',
    status: 'PENDING',
    reference: 'order-1',
    referenceType: 'PRODUCTION_ORDER',
    sequence: null,
    priority: 0,
    assignedTo: null,
    assignee: null,
    productId: 'prod-1',
    product: { id: 'prod-1', code: 'P001', name: 'Produto Um' },
    lotId: null,
    lot: null,
    quantity: '10.0000',
    fromPositionId: 'pos-1',
    fromPosition: { id: 'pos-1', code: 'ARM-RUA-AA-01' },
    toPositionId: null,
    toPosition: null,
    version: 1,
    createdAt: '2026-09-01T00:00:00.000Z',
    startedAt: null,
    completedAt: null,
    ...overrides,
  }
}

const replenishmentTask = makeTask({
  id: 'task-replenishment',
  type: 'REPLENISHMENT',
  productId: 'prod-2',
  product: { id: 'prod-2', code: 'P002', name: 'Produto Dois' },
})

// AppModal usa <Teleport to="body">, então o conteúdo do modal fica FORA da
// subárvore de `wrapper.element` — mesmo padrão de busca usado em
// OperationsPanelView.spec.ts para interagir com diálogos teleportados.
function findButtonByText(root: ParentNode, text: string): HTMLButtonElement {
  const button = Array.from(root.querySelectorAll('button')).find((b) => b.textContent?.trim() === text)
  if (!button) throw new Error(`Botão com texto exato "${text}" não encontrado`)
  return button as HTMLButtonElement
}

function findAllButtonsByText(root: ParentNode, text: string): HTMLButtonElement[] {
  return Array.from(root.querySelectorAll('button')).filter(
    (b) => b.textContent?.trim() === text
  ) as HTMLButtonElement[]
}

function makeRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/wms/picking', component: PickingView },
      { path: '/login', component: { template: '<div />' } },
    ],
  })
}

async function mountView() {
  const router = makeRouter()
  router.push('/wms/picking')
  await router.isReady()
  const wrapper = mount(PickingView, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

describe('PickingView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    document.body.innerHTML = ''
    useToast().toasts.splice(0)
  })

  it('lista só tarefas PICKING, ignorando REPLENISHMENT', async () => {
    const pickingTask = makeTask()
    vi.mocked(warehouseTaskService.getMyTasks).mockResolvedValue({
      data: { data: [pickingTask, replenishmentTask] },
    } as any)

    const wrapper = await mountView()

    expect(wrapper.text()).toContain('P001')
    expect(wrapper.text()).not.toContain('P002')
  })

  it('botão Iniciar chama start com o id certo e recarrega a lista', async () => {
    const pendingTask = makeTask({ id: 'task-pending', assignedTo: null, status: 'PENDING' })
    vi.mocked(warehouseTaskService.getMyTasks).mockResolvedValue({
      data: { data: [pendingTask] },
    } as any)
    vi.mocked(warehouseTaskService.start).mockResolvedValue({ data: { data: pendingTask } } as any)

    const wrapper = await mountView()

    const startButton = findButtonByText(wrapper.element, 'Iniciar')
    startButton.click()
    await flushPromises()

    expect(warehouseTaskService.start).toHaveBeenCalledWith('task-pending')
    expect(warehouseTaskService.getMyTasks).toHaveBeenCalledTimes(2)
  })

  it('Confirmar Separação abre o modal e chama execute com id e version corretos', async () => {
    const inProgressTask = makeTask({
      id: 'task-in-progress',
      status: 'IN_PROGRESS',
      assignedTo: 'user-me',
      version: 3,
    })
    vi.mocked(warehouseTaskService.getMyTasks).mockResolvedValue({
      data: { data: [inProgressTask] },
    } as any)
    vi.mocked(warehouseTaskService.execute).mockResolvedValue({
      data: { data: { task: inProgressTask, movementId: 'mov-1' } },
    } as any)

    const wrapper = await mountView()

    const openModalButton = findButtonByText(wrapper.element, 'Confirmar Separação')
    openModalButton.click()
    await wrapper.vm.$nextTick()

    // Modal aberto (Teleport para document.body) — mostra o resumo do que será executado.
    expect(document.body.textContent).toContain('ARM-RUA-AA-01')

    // Um botão "Confirmar Separação" no card (fora do modal) e outro no rodapé
    // do modal teleportado — o segundo é o que dispara `execute`.
    const modalConfirmButtons = findAllButtonsByText(document.body, 'Confirmar Separação')
    expect(modalConfirmButtons.length).toBe(2)
    modalConfirmButtons[1].click()
    await flushPromises()

    expect(warehouseTaskService.execute).toHaveBeenCalledWith('task-in-progress', 3)
    expect(
      useToast().toasts.some((t) => t.type === 'success' && t.message === 'Separação registrada, estoque baixado.')
    ).toBe(true)
  })

  it('tarefa atribuída a outro usuário não mostra nenhum botão de ação', async () => {
    const othersTask = makeTask({
      id: 'task-other',
      status: 'IN_PROGRESS',
      assignedTo: 'other-user',
      assignee: { id: 'other-user', name: 'Outro Operador' },
    })
    vi.mocked(warehouseTaskService.getMyTasks).mockResolvedValue({
      data: { data: [othersTask] },
    } as any)

    const wrapper = await mountView()

    expect(
      (Array.from(wrapper.element.querySelectorAll('button')) as HTMLButtonElement[]).some(
        (b) => b.textContent?.trim() === 'Iniciar'
      )
    ).toBe(false)
    expect(
      (Array.from(wrapper.element.querySelectorAll('button')) as HTMLButtonElement[]).some(
        (b) => b.textContent?.trim() === 'Confirmar Separação'
      )
    ).toBe(false)
    expect(wrapper.text()).toContain('Outro Operador')
  })
})
