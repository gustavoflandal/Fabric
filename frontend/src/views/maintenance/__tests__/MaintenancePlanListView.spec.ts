import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, DOMWrapper } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { setActivePinia, createPinia } from 'pinia'
import MaintenancePlanListView from '../MaintenancePlanListView.vue'
import maintenancePlanService from '@/services/maintenance-plan.service'
import equipmentService from '@/services/equipment.service'

vi.mock('@/services/maintenance-plan.service', () => ({
  default: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), toggleActive: vi.fn() },
}))

vi.mock('@/services/equipment.service', () => ({
  default: { getAll: vi.fn() },
}))

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ userName: 'Teste', logout: vi.fn() }),
}))

vi.mock('@/stores/theme.store', () => ({
  useThemeStore: () => ({ mode: 'system', isDark: false, setMode: vi.fn() }),
}))

const mockEquipment = { id: 'eq-1', code: 'EQP-001', name: 'Torno CNC 1', workCenterId: 'wc-1', active: true, createdAt: '', updatedAt: '' }

const mockPlan = {
  id: 'plan-1',
  equipmentId: 'eq-1',
  name: 'Lubrificação mensal',
  description: null,
  frequencyDays: 30,
  nextDueDate: '2026-10-01T00:00:00.000Z',
  active: true,
  createdAt: '',
  updatedAt: '',
  equipment: { id: 'eq-1', code: 'EQP-001', name: 'Torno CNC 1' },
}

function makeRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/maintenance/plans', component: MaintenancePlanListView },
      { path: '/login', component: { template: '<div />' } },
    ],
  })
}

describe('MaintenancePlanListView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // useEquipmentStore()/useMaintenancePlanStore() são Pinia reais (só os
    // services são mockados) — precisam de uma instância ativa, mesmo padrão
    // já usado em OperationsPanelView.spec.ts.
    setActivePinia(createPinia())
    vi.mocked(equipmentService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockEquipment], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('carrega e exibe a lista de planos com o nome do equipamento e a frequência', async () => {
    vi.mocked(maintenancePlanService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockPlan], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)

    const router = makeRouter()
    router.push('/maintenance/plans')
    await router.isReady()

    const wrapper = mount(MaintenancePlanListView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.text()).toContain('Lubrificação mensal')
    expect(wrapper.text()).toContain('Torno CNC 1')
    expect(wrapper.text()).toContain('a cada 30 dia(s)')
  })

  it('cria um plano novo pelo formulário', async () => {
    vi.mocked(maintenancePlanService.getAll).mockResolvedValue({
      data: { status: 'success', data: [], pagination: { page: 1, limit: 100, total: 0, pages: 0 } },
    } as any)
    vi.mocked(maintenancePlanService.create).mockResolvedValue({ data: { status: 'success', data: mockPlan } } as any)

    const router = makeRouter()
    router.push('/maintenance/plans')
    await router.isReady()

    // attachTo: document.body é necessário porque o AppModal renderiza via
    // <Teleport to="body">— sem isso, o DOMWrapper abaixo não alcançaria
    // nada (mesmo padrão de AppModal.spec.ts).
    const wrapper = mount(MaintenancePlanListView, { global: { plugins: [router] }, attachTo: document.body })
    await flushPromises()

    // AppLayout renderiza o botão "Sair" ANTES do botão de ação da slot no
    // DOM — um seletor por `button:not([type="submit"])` pegaria "Sair" por
    // engano. Filtrar pelo texto exato é o padrão já usado em
    // WorkflowTemplateEditorView.spec.ts.
    const novoButton = wrapper.findAll('button').find((b) => b.text().includes('Novo Plano'))!
    await novoButton.trigger('click')
    await wrapper.vm.$nextTick()

    // O formulário vive dentro do <Teleport to="body"> do AppModal, fora da
    // árvore do wrapper — as consultas precisam ir por um DOMWrapper sobre o
    // document.body real.
    const body = new DOMWrapper(document.body)
    await body.find('#mp-form-equipment').setValue('eq-1')
    await body.find('#mp-form-name').setValue('Inspeção trimestral')
    await body.find('#mp-form-frequency').setValue(90)
    await body.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(maintenancePlanService.create).toHaveBeenCalledWith(
      expect.objectContaining({ equipmentId: 'eq-1', name: 'Inspeção trimestral', frequencyDays: 90 })
    )
  })
})
