import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, DOMWrapper } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { setActivePinia, createPinia } from 'pinia'
import YardSpotListView from '../YardSpotListView.vue'
import yardSpotService from '@/services/yard-spot.service'
import yardAreaService from '@/services/yard-area.service'

vi.mock('@/services/yard-spot.service', () => ({
  default: { getAll: vi.fn(), update: vi.fn(), delete: vi.fn(), setBlocked: vi.fn() },
}))
vi.mock('@/services/yard-area.service', () => ({
  default: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), setBlocked: vi.fn(), generateSpots: vi.fn() },
}))
vi.mock('@/stores/auth.store', () => ({ useAuthStore: () => ({ userName: 'Teste', logout: vi.fn() }) }))
vi.mock('@/stores/theme.store', () => ({ useThemeStore: () => ({ mode: 'system', isDark: false, setMode: vi.fn() }) }))

const mockArea = {
  id: 'area-1', warehouseId: 'wh-1', code: 'SETOR-A', name: 'Setor A', active: true, blocked: false, blockedReason: null,
  createdAt: '', updatedAt: '',
}
const mockSpot = {
  id: 'spot-1', areaId: 'area-1', code: 'SETOR-A-01', active: true, blocked: false, blockedReason: null,
  createdAt: '', updatedAt: '', area: { id: 'area-1', code: 'SETOR-A', name: 'Setor A' }, visits: [],
}

function makeRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [{ path: '/yard/areas/:areaId/spots', component: YardSpotListView, name: 'yard-area-spots' }],
  })
}

describe('YardSpotListView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    vi.mocked(yardAreaService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockArea], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('carrega e exibe as vagas da área da rota, mostrando "livre" quando não há visita ativa', async () => {
    vi.mocked(yardSpotService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockSpot], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)

    const router = makeRouter()
    router.push('/yard/areas/area-1/spots')
    await router.isReady()

    const wrapper = mount(YardSpotListView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.text()).toContain('SETOR-A-01')
    expect(yardSpotService.getAll).toHaveBeenCalledWith(1, 100, { areaId: 'area-1', blocked: undefined })
  })

  it('gera vagas em lote informando a quantidade', async () => {
    vi.mocked(yardSpotService.getAll).mockResolvedValue({
      data: { status: 'success', data: [], pagination: { page: 1, limit: 100, total: 0, pages: 0 } },
    } as any)
    vi.mocked(yardAreaService.generateSpots).mockResolvedValue({ data: { status: 'success', data: [] } } as any)

    const router = makeRouter()
    router.push('/yard/areas/area-1/spots')
    await router.isReady()

    const wrapper = mount(YardSpotListView, { global: { plugins: [router] }, attachTo: document.body })
    await flushPromises()

    const generateButton = wrapper.findAll('button').find((b) => b.text().includes('Gerar Vagas'))!
    await generateButton.trigger('click')
    await wrapper.vm.$nextTick()

    const body = new DOMWrapper(document.body)
    await body.find('#generate-spots-count').setValue('10')
    await body.find('#generate-spots-form').trigger('submit.prevent')
    await flushPromises()

    expect(yardAreaService.generateSpots).toHaveBeenCalledWith('area-1', 10)
  })
})
