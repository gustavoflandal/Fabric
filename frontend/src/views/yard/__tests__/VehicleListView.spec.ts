import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, DOMWrapper } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { setActivePinia, createPinia } from 'pinia'
import VehicleListView from '../VehicleListView.vue'
import vehicleService from '@/services/vehicle.service'
import supplierService from '@/services/supplier.service'
import fleetService from '@/services/fleet.service'

vi.mock('@/services/vehicle.service', () => ({
  default: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), setBlocked: vi.fn() },
}))

vi.mock('@/services/supplier.service', () => ({
  default: { getAll: vi.fn() },
}))

vi.mock('@/services/fleet.service', () => ({
  default: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), setBlocked: vi.fn() },
}))

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ userName: 'Teste', logout: vi.fn() }),
}))

vi.mock('@/stores/theme.store', () => ({
  useThemeStore: () => ({ mode: 'system', isDark: false, setMode: vi.fn() }),
}))

const mockSupplier = { id: 'sup-1', code: 'SUP-1', name: 'Transportadora Alfa', active: true, createdAt: '', updatedAt: '' }
const mockFleet = { id: 'fleet-1', name: 'Frota A', supplierId: 'sup-1', blocked: false, blockedReason: null, createdAt: '', updatedAt: '' }

const mockVehicle = {
  id: 'veh-1',
  plate: 'ABC1D23',
  type: 'TRUCK',
  supplierId: 'sup-1',
  fleetId: 'fleet-1',
  blocked: false,
  blockedReason: null,
  createdAt: '',
  updatedAt: '',
  supplier: { id: 'sup-1', code: 'SUP-1', name: 'Transportadora Alfa' },
  fleet: { id: 'fleet-1', name: 'Frota A' },
}

function makeRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/yard/vehicles', component: VehicleListView },
      { path: '/login', component: { template: '<div />' } },
    ],
  })
}

describe('VehicleListView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    vi.mocked(supplierService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockSupplier], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)
    vi.mocked(fleetService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockFleet], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('carrega e exibe a lista de veículos', async () => {
    vi.mocked(vehicleService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockVehicle], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)

    const router = makeRouter()
    router.push('/yard/vehicles')
    await router.isReady()

    const wrapper = mount(VehicleListView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.text()).toContain('ABC1D23')
    expect(wrapper.text()).toContain('Transportadora Alfa')
    expect(wrapper.text()).toContain('Frota A')
  })

  it('cria um veículo novo, com a frota filtrada pelo fornecedor selecionado', async () => {
    vi.mocked(vehicleService.getAll).mockResolvedValue({
      data: { status: 'success', data: [], pagination: { page: 1, limit: 100, total: 0, pages: 0 } },
    } as any)
    vi.mocked(vehicleService.create).mockResolvedValue({ data: { status: 'success', data: mockVehicle } } as any)

    const router = makeRouter()
    router.push('/yard/vehicles')
    await router.isReady()

    const wrapper = mount(VehicleListView, { global: { plugins: [router] }, attachTo: document.body })
    await flushPromises()

    const novoButton = wrapper.findAll('button').find((b) => b.text().includes('Novo Veículo'))!
    await novoButton.trigger('click')
    await wrapper.vm.$nextTick()

    const body = new DOMWrapper(document.body)
    await body.find('#vehicle-form-plate').setValue('abc1d23')
    await body.find('#vehicle-form-type').setValue('TRUCK')
    await body.find('#vehicle-form-supplier').setValue('sup-1')
    await wrapper.vm.$nextTick()
    // A frota só aparece disponível DEPOIS de escolher o fornecedor (filtro client-side).
    expect(body.find('#vehicle-form-fleet').findAll('option').some((o) => o.text() === 'Frota A')).toBe(true)
    await body.find('#vehicle-form-fleet').setValue('fleet-1')
    await body.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(vehicleService.create).toHaveBeenCalledWith(
      expect.objectContaining({ plate: 'abc1d23', type: 'TRUCK', supplierId: 'sup-1', fleetId: 'fleet-1' })
    )
  })
})
