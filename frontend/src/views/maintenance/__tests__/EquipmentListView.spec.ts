import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, DOMWrapper } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { setActivePinia, createPinia } from 'pinia'
import EquipmentListView from '../EquipmentListView.vue'
import equipmentService from '@/services/equipment.service'
import workCenterService from '@/services/work-center.service'

vi.mock('@/services/equipment.service', () => ({
  default: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), toggleActive: vi.fn() },
}))

vi.mock('@/services/work-center.service', () => ({
  default: { getAll: vi.fn() },
}))

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ userName: 'Teste', logout: vi.fn() }),
}))

vi.mock('@/stores/theme.store', () => ({
  useThemeStore: () => ({ mode: 'system', isDark: false, setMode: vi.fn() }),
}))

const mockWorkCenter = { id: 'wc-1', code: 'WC-1', name: 'Usinagem', type: 'machine', efficiency: 1, active: true, createdAt: '', updatedAt: '' }

const mockEquipment = {
  id: 'eq-1',
  code: 'EQP-001',
  name: 'Torno CNC 1',
  workCenterId: 'wc-1',
  manufacturer: 'Romi',
  model: 'GL-240',
  active: true,
  createdAt: '',
  updatedAt: '',
  workCenter: { id: 'wc-1', code: 'WC-1', name: 'Usinagem' },
}

function makeRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/maintenance/equipment', component: EquipmentListView },
      { path: '/login', component: { template: '<div />' } },
    ],
  })
}

describe('EquipmentListView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    vi.mocked(workCenterService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockWorkCenter], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('carrega e exibe a lista de equipamentos', async () => {
    vi.mocked(equipmentService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockEquipment], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)

    const router = makeRouter()
    router.push('/maintenance/equipment')
    await router.isReady()

    const wrapper = mount(EquipmentListView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.text()).toContain('EQP-001')
    expect(wrapper.text()).toContain('Torno CNC 1')
    expect(wrapper.text()).toContain('Usinagem')
    expect(wrapper.text()).toContain('Romi / GL-240')
  })

  it('cria um equipamento novo pelo formulário', async () => {
    vi.mocked(equipmentService.getAll).mockResolvedValue({
      data: { status: 'success', data: [], pagination: { page: 1, limit: 100, total: 0, pages: 0 } },
    } as any)
    vi.mocked(equipmentService.create).mockResolvedValue({ data: { status: 'success', data: mockEquipment } } as any)

    const router = makeRouter()
    router.push('/maintenance/equipment')
    await router.isReady()

    const wrapper = mount(EquipmentListView, { global: { plugins: [router] }, attachTo: document.body })
    await flushPromises()

    const novoButton = wrapper.findAll('button').find((b) => b.text().includes('Novo Equipamento'))!
    await novoButton.trigger('click')
    await wrapper.vm.$nextTick()

    // O formulario vive dentro do <Teleport to="body"> do AppModal, fora da
    // arvore do wrapper — por isso as consultas vao por um DOMWrapper sobre
    // o document.body real (mesmo padrao de AppModal.spec.ts:17-20).
    const body = new DOMWrapper(document.body)
    await body.find('#eq-form-code').setValue('EQP-002')
    await body.find('#eq-form-name').setValue('Prensa Hidráulica')
    await body.find('#eq-form-work-center').setValue('wc-1')
    await body.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(equipmentService.create).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'EQP-002', name: 'Prensa Hidráulica', workCenterId: 'wc-1' })
    )
  })
})
