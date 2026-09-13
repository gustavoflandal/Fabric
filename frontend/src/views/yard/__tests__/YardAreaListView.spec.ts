import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, DOMWrapper } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { setActivePinia, createPinia } from 'pinia'
import YardAreaListView from '../YardAreaListView.vue'
import yardAreaService from '@/services/yard-area.service'
import warehouseService from '@/services/warehouse.service'

vi.mock('@/services/yard-area.service', () => ({
  default: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), setBlocked: vi.fn(), generateSpots: vi.fn() },
}))
vi.mock('@/services/warehouse.service', () => ({ default: { getAll: vi.fn() } }))
vi.mock('@/stores/auth.store', () => ({ useAuthStore: () => ({ userName: 'Teste', logout: vi.fn() }) }))
vi.mock('@/stores/theme.store', () => ({ useThemeStore: () => ({ mode: 'system', isDark: false, setMode: vi.fn() }) }))

const mockWarehouse = { id: 'wh-1', code: 'WH-1', name: 'Armazém Central', active: true, createdAt: '', updatedAt: '' }
const mockArea = {
  id: 'area-1', warehouseId: 'wh-1', code: 'SETOR-A', name: 'Setor A', active: true, blocked: false, blockedReason: null,
  createdAt: '', updatedAt: '', warehouse: { id: 'wh-1', code: 'WH-1', name: 'Armazém Central' }, _count: { spots: 5 },
}

function makeRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/yard/areas', component: YardAreaListView },
      { path: '/yard/areas/:areaId/spots', component: { template: '<div />' } },
      { path: '/login', component: { template: '<div />' } },
    ],
  })
}

describe('YardAreaListView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    vi.mocked(warehouseService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockWarehouse], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('carrega e exibe a lista de áreas, com a contagem de vagas', async () => {
    vi.mocked(yardAreaService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockArea], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)

    const router = makeRouter()
    router.push('/yard/areas')
    await router.isReady()

    const wrapper = mount(YardAreaListView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.text()).toContain('Setor A')
    expect(wrapper.text()).toContain('5')
  })

  it('cria uma área nova', async () => {
    vi.mocked(yardAreaService.getAll).mockResolvedValue({
      data: { status: 'success', data: [], pagination: { page: 1, limit: 100, total: 0, pages: 0 } },
    } as any)
    vi.mocked(yardAreaService.create).mockResolvedValue({ data: { status: 'success', data: mockArea } } as any)

    const router = makeRouter()
    router.push('/yard/areas')
    await router.isReady()

    const wrapper = mount(YardAreaListView, { global: { plugins: [router] }, attachTo: document.body })
    await flushPromises()

    const novoButton = wrapper.findAll('button').find((b) => b.text().includes('Nova Área'))!
    await novoButton.trigger('click')
    await wrapper.vm.$nextTick()

    const body = new DOMWrapper(document.body)
    await body.find('#area-form-warehouse').setValue('wh-1')
    await body.find('#area-form-code').setValue('SETOR-B')
    await body.find('#area-form-name').setValue('Setor B')
    await body.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(yardAreaService.create).toHaveBeenCalledWith(
      expect.objectContaining({ warehouseId: 'wh-1', code: 'SETOR-B', name: 'Setor B' })
    )
  })
})
