import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, DOMWrapper } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { setActivePinia, createPinia } from 'pinia'
import MaintenanceOrderListView from '../MaintenanceOrderListView.vue'
import maintenanceOrderService from '@/services/maintenance-order.service'
import equipmentService from '@/services/equipment.service'
import userService from '@/services/user.service'

vi.mock('@/services/maintenance-order.service', () => ({
  default: { getAll: vi.fn(), create: vi.fn(), start: vi.fn(), complete: vi.fn(), cancel: vi.fn() },
}))

vi.mock('@/services/equipment.service', () => ({
  default: { getAll: vi.fn() },
}))

vi.mock('@/services/user.service', () => ({
  default: { getAll: vi.fn() },
}))

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ userName: 'Teste', logout: vi.fn() }),
}))

vi.mock('@/stores/theme.store', () => ({
  useThemeStore: () => ({ mode: 'system', isDark: false, setMode: vi.fn() }),
}))

vi.mock('@/composables/useConfirm', () => ({
  confirmDialog: vi.fn().mockResolvedValue(true),
}))

const mockEquipment = { id: 'eq-1', code: 'EQP-001', name: 'Torno CNC 1', workCenterId: 'wc-1', active: true, createdAt: '', updatedAt: '' }

const mockOrderPending = {
  id: 'order-1',
  equipmentId: 'eq-1',
  planId: null,
  type: 'CORRECTIVE' as const,
  status: 'PENDING' as const,
  problemDescription: 'Ruído anormal',
  resolutionNotes: null,
  assignedTo: null,
  createdAt: '',
  startedAt: null,
  completedAt: null,
  equipment: { id: 'eq-1', code: 'EQP-001', name: 'Torno CNC 1' },
}

function makeRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/maintenance/orders', component: MaintenanceOrderListView },
      { path: '/login', component: { template: '<div />' } },
    ],
  })
}

describe('MaintenanceOrderListView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // useEquipmentStore()/useMaintenanceOrderStore() são Pinia reais (só os
    // services são mockados) — precisam de uma instância ativa.
    setActivePinia(createPinia())
    vi.mocked(equipmentService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockEquipment], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)
    vi.mocked(userService.getAll).mockResolvedValue({ status: 'success', data: [], pagination: {} } as any)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('carrega e exibe a lista de ordens com o botão Iniciar para uma ordem PENDING', async () => {
    vi.mocked(maintenanceOrderService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockOrderPending], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)

    const router = makeRouter()
    router.push('/maintenance/orders')
    await router.isReady()

    const wrapper = mount(MaintenanceOrderListView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.text()).toContain('Torno CNC 1')
    expect(wrapper.text()).toContain('Ruído anormal')
    expect(wrapper.text()).toContain('Iniciar')
    expect(wrapper.text()).not.toContain('Concluir')
  })

  it('chama startOrder ao clicar em Iniciar', async () => {
    vi.mocked(maintenanceOrderService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockOrderPending], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)
    vi.mocked(maintenanceOrderService.start).mockResolvedValue({ data: { status: 'success', data: {} } } as any)

    const router = makeRouter()
    router.push('/maintenance/orders')
    await router.isReady()

    const wrapper = mount(MaintenanceOrderListView, { global: { plugins: [router] } })
    await flushPromises()

    const startButton = wrapper.findAll('button').find((b) => b.text() === 'Iniciar')!
    await startButton.trigger('click')
    await flushPromises()

    expect(maintenanceOrderService.start).toHaveBeenCalledWith('order-1')
  })

  it('abre uma ordem corretiva pelo formulário', async () => {
    vi.mocked(maintenanceOrderService.getAll).mockResolvedValue({
      data: { status: 'success', data: [], pagination: { page: 1, limit: 100, total: 0, pages: 0 } },
    } as any)
    vi.mocked(maintenanceOrderService.create).mockResolvedValue({ data: { status: 'success', data: mockOrderPending } } as any)

    const router = makeRouter()
    router.push('/maintenance/orders')
    await router.isReady()

    // attachTo: document.body é necessário porque o AppModal renderiza via
    // <Teleport to="body">— sem isso, o DOMWrapper abaixo não alcançaria nada.
    const wrapper = mount(MaintenanceOrderListView, { global: { plugins: [router] }, attachTo: document.body })
    await flushPromises()

    // AppLayout renderiza o botão "Sair" ANTES do botão de ação da slot no
    // DOM — filtrar pelo texto exato evita pegar "Sair" por engano.
    const novaOrdemButton = wrapper.findAll('button').find((b) => b.text().includes('Nova Ordem Corretiva'))!
    await novaOrdemButton.trigger('click')
    await wrapper.vm.$nextTick()

    // O formulário vive dentro do <Teleport to="body"> do AppModal, fora da
    // árvore do wrapper — as consultas precisam ir por um DOMWrapper sobre o
    // document.body real.
    const body = new DOMWrapper(document.body)
    await body.find('#mo-form-equipment').setValue('eq-1')
    await body.find('#mo-form-problem').setValue('Vazamento de óleo')
    await body.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(maintenanceOrderService.create).toHaveBeenCalledWith(
      expect.objectContaining({ equipmentId: 'eq-1', problemDescription: 'Vazamento de óleo' })
    )
  })

  it('Fix 2a: carrega a lista de ordens mesmo quando userService.getAll() falha (perfil OPERATOR não tem usuarios:visualizar)', async () => {
    vi.mocked(userService.getAll).mockRejectedValue({ response: { status: 403, data: { message: 'Permissão negada' } } })
    vi.mocked(maintenanceOrderService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockOrderPending], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)

    const router = makeRouter()
    router.push('/maintenance/orders')
    await router.isReady()

    const wrapper = mount(MaintenanceOrderListView, { global: { plugins: [router] } })
    await flushPromises()

    // A lista de ordens carregou normalmente, apesar da falha na busca de usuários.
    expect(wrapper.text()).toContain('Torno CNC 1')
    expect(wrapper.text()).toContain('Ruído anormal')
  })
})
