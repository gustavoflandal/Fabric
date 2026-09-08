import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, DOMWrapper } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { setActivePinia, createPinia } from 'pinia'
import YardDockListView from '../YardDockListView.vue'
import yardDockService from '@/services/yard-dock.service'
import warehouseService from '@/services/warehouse.service'

vi.mock('@/services/yard-dock.service', () => ({
  default: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
}))

vi.mock('@/services/warehouse.service', () => ({
  default: { getAll: vi.fn() },
}))

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ userName: 'Teste', logout: vi.fn() }),
}))

vi.mock('@/stores/theme.store', () => ({
  useThemeStore: () => ({ mode: 'system', isDark: false, setMode: vi.fn() }),
}))

const mockWarehouse = { id: 'wh-1', code: 'WH-1', name: 'Armazém Central', active: true, createdAt: '', updatedAt: '' }

const mockDock = {
  id: 'dock-1',
  code: 'DOCA-01',
  serviceType: 'RECEBIMENTO',
  warehouseId: 'wh-1',
  storagePositionId: null,
  active: true,
  createdAt: '',
  updatedAt: '',
  warehouse: { id: 'wh-1', code: 'WH-1', name: 'Armazém Central' },
}

function makeRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/yard/docks', component: YardDockListView },
      { path: '/login', component: { template: '<div />' } },
    ],
  })
}

describe('YardDockListView', () => {
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

  it('carrega e exibe a lista de docas', async () => {
    vi.mocked(yardDockService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockDock], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)

    const router = makeRouter()
    router.push('/yard/docks')
    await router.isReady()

    const wrapper = mount(YardDockListView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.text()).toContain('DOCA-01')
    expect(wrapper.text()).toContain('Armazém Central')
  })

  it('cria uma doca nova pelo formulário', async () => {
    vi.mocked(yardDockService.getAll).mockResolvedValue({
      data: { status: 'success', data: [], pagination: { page: 1, limit: 100, total: 0, pages: 0 } },
    } as any)
    vi.mocked(yardDockService.create).mockResolvedValue({ data: { status: 'success', data: mockDock } } as any)

    const router = makeRouter()
    router.push('/yard/docks')
    await router.isReady()

    const wrapper = mount(YardDockListView, { global: { plugins: [router] }, attachTo: document.body })
    await flushPromises()

    const novoButton = wrapper.findAll('button').find((b) => b.text().includes('Nova Doca'))!
    await novoButton.trigger('click')
    await wrapper.vm.$nextTick()

    const body = new DOMWrapper(document.body)
    await body.find('#dock-form-code').setValue('DOCA-02')
    await body.find('#dock-form-service-type').setValue('EXPEDICAO')
    await body.find('#dock-form-warehouse').setValue('wh-1')
    await body.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(yardDockService.create).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'DOCA-02', serviceType: 'EXPEDICAO', warehouseId: 'wh-1' })
    )
  })
})
