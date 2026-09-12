import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, DOMWrapper } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { setActivePinia, createPinia } from 'pinia'
import FleetListView from '../FleetListView.vue'
import fleetService from '@/services/fleet.service'
import supplierService from '@/services/supplier.service'

vi.mock('@/services/fleet.service', () => ({
  default: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), setBlocked: vi.fn() },
}))

vi.mock('@/services/supplier.service', () => ({
  default: { getAll: vi.fn() },
}))

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ userName: 'Teste', logout: vi.fn() }),
}))

vi.mock('@/stores/theme.store', () => ({
  useThemeStore: () => ({ mode: 'system', isDark: false, setMode: vi.fn() }),
}))

const mockSupplier = { id: 'sup-1', code: 'SUP-1', name: 'Transportadora Alfa', active: true, createdAt: '', updatedAt: '' }

const mockFleet = {
  id: 'fleet-1',
  name: 'Frota Refrigerada',
  supplierId: 'sup-1',
  blocked: false,
  blockedReason: null,
  createdAt: '',
  updatedAt: '',
  supplier: { id: 'sup-1', code: 'SUP-1', name: 'Transportadora Alfa' },
  _count: { vehicles: 3 },
}

function makeRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/yard/fleets', component: FleetListView },
      { path: '/login', component: { template: '<div />' } },
    ],
  })
}

describe('FleetListView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    vi.mocked(supplierService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockSupplier], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('carrega e exibe a lista de frotas, com a contagem de veículos', async () => {
    vi.mocked(fleetService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockFleet], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)

    const router = makeRouter()
    router.push('/yard/fleets')
    await router.isReady()

    const wrapper = mount(FleetListView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.text()).toContain('Frota Refrigerada')
    expect(wrapper.text()).toContain('3')
  })

  it('bloqueia uma frota informando o motivo', async () => {
    vi.mocked(fleetService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockFleet], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)
    vi.mocked(fleetService.setBlocked).mockResolvedValue({ data: { status: 'success', data: { ...mockFleet, blocked: true } } } as any)

    const router = makeRouter()
    router.push('/yard/fleets')
    await router.isReady()

    const wrapper = mount(FleetListView, { global: { plugins: [router] }, attachTo: document.body })
    await flushPromises()

    const blockButton = wrapper.findAll('button').find((b) => b.text().trim() === 'Bloquear')!
    await blockButton.trigger('click')
    await wrapper.vm.$nextTick()

    const body = new DOMWrapper(document.body)
    expect(body.text()).toContain('3 veículo')
    await body.find('#fleet-block-reason').setValue('Inadimplência')
    await body.find('#fleet-block-form').trigger('submit.prevent')
    await flushPromises()

    expect(fleetService.setBlocked).toHaveBeenCalledWith('fleet-1', true, 'Inadimplência')
  })
})
