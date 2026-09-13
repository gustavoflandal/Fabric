import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, DOMWrapper } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { setActivePinia, createPinia } from 'pinia'
import YardVisitListView from '../YardVisitListView.vue'
import yardVisitService from '@/services/yard-visit.service'
import warehouseService from '@/services/warehouse.service'
import supplierService from '@/services/supplier.service'
import driverService from '@/services/driver.service'
import vehicleService from '@/services/vehicle.service'
import purchaseOrderService from '@/services/purchase-order.service'
import yardWarehouseParamsService from '@/services/yard-warehouse-params.service'
import yardAreaService from '@/services/yard-area.service'
import yardSpotService from '@/services/yard-spot.service'

vi.mock('@/services/yard-visit.service', () => ({
  default: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), checkIn: vi.fn(), cancel: vi.fn(), allocateSpot: vi.fn() },
}))
vi.mock('@/services/warehouse.service', () => ({ default: { getAll: vi.fn() } }))
vi.mock('@/services/supplier.service', () => ({ default: { getAll: vi.fn() } }))
vi.mock('@/services/driver.service', () => ({
  default: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), setBlocked: vi.fn() },
}))
vi.mock('@/services/vehicle.service', () => ({
  default: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), setBlocked: vi.fn() },
}))
vi.mock('@/services/purchase-order.service', () => ({ default: { getAll: vi.fn() } }))
vi.mock('@/services/yard-warehouse-params.service', () => ({
  default: { getByWarehouseId: vi.fn(), upsert: vi.fn() },
}))
vi.mock('@/services/yard-area.service', () => ({
  default: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), setBlocked: vi.fn(), generateSpots: vi.fn() },
}))
vi.mock('@/services/yard-spot.service', () => ({
  default: { getAll: vi.fn(), update: vi.fn(), delete: vi.fn(), setBlocked: vi.fn() },
}))

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ userName: 'Teste', logout: vi.fn() }),
}))
vi.mock('@/stores/theme.store', () => ({
  useThemeStore: () => ({ mode: 'system', isDark: false, setMode: vi.fn() }),
}))

const mockWarehouse = { id: 'wh-1', code: 'WH-1', name: 'Armazém Central', active: true, createdAt: '', updatedAt: '' }
const mockSupplier = { id: 'sup-1', code: 'SUP-1', name: 'Transportadora Alfa', active: true, createdAt: '', updatedAt: '' }
const mockDriver = { id: 'drv-1', name: 'João da Silva', cpf: '12345678901', supplierId: 'sup-1', blocked: false, blockedReason: null, createdAt: '', updatedAt: '' }
const mockVehicle = { id: 'veh-1', plate: 'ABC1D23', type: 'TRUCK', supplierId: 'sup-1', fleetId: null, blocked: false, blockedReason: null, createdAt: '', updatedAt: '' }

const mockVisit = {
  id: 'visit-1',
  warehouseId: 'wh-1',
  serviceType: 'RECEBIMENTO',
  supplierId: 'sup-1',
  purchaseOrderId: null,
  scheduledAt: new Date().toISOString(),
  status: 'SCHEDULED',
  notes: null,
  driverId: null,
  vehicleId: null,
  checkedInAt: null,
  punctuality: 'ANTECIPADO',
  createdAt: '',
  updatedAt: '',
  warehouse: { id: 'wh-1', code: 'WH-1', name: 'Armazém Central' },
  supplier: { id: 'sup-1', code: 'SUP-1', name: 'Transportadora Alfa' },
  driver: null,
  vehicle: null,
}

const mockCancelledVisit = {
  ...mockVisit,
  id: 'visit-2',
  status: 'CANCELLED',
  punctuality: null,
}

function makeRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/yard/visits', component: YardVisitListView },
      { path: '/login', component: { template: '<div />' } },
    ],
  })
}

describe('YardVisitListView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    vi.mocked(warehouseService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockWarehouse], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)
    vi.mocked(supplierService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockSupplier], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)
    vi.mocked(driverService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockDriver], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)
    vi.mocked(vehicleService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockVehicle], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)
    vi.mocked(purchaseOrderService.getAll).mockResolvedValue({
      data: { status: 'success', data: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } },
    } as any)
    vi.mocked(yardWarehouseParamsService.getByWarehouseId).mockResolvedValue({
      data: { status: 'success', data: { id: null, warehouseId: 'wh-1', useYard: true, delayToleranceMinutes: 15, createdAt: null, updatedAt: null } },
    } as any)
    vi.mocked(yardAreaService.getAll).mockResolvedValue({
      data: { status: 'success', data: [{ id: 'area-1', warehouseId: 'wh-1', code: 'SETOR-A', name: 'Setor A', active: true, blocked: false, blockedReason: null, createdAt: '', updatedAt: '' }], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)
    vi.mocked(yardSpotService.getAll).mockResolvedValue({
      data: { status: 'success', data: [{ id: 'spot-1', areaId: 'area-1', code: 'SETOR-A-01', active: true, blocked: false, blockedReason: null, createdAt: '', updatedAt: '', visits: [] }], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('carrega e exibe a lista de visitas, mostrando a pontualidade quando presente', async () => {
    vi.mocked(yardVisitService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockVisit], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)

    const router = makeRouter()
    router.push('/yard/visits')
    await router.isReady()

    const wrapper = mount(YardVisitListView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.text()).toContain('Armazém Central')
    expect(wrapper.text()).toContain('Transportadora Alfa')
    expect(wrapper.text()).toContain('Antecipado')
  })

  it('não exibe pontualidade para visitas canceladas', async () => {
    vi.mocked(yardVisitService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockCancelledVisit], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)

    const router = makeRouter()
    router.push('/yard/visits')
    await router.isReady()

    const wrapper = mount(YardVisitListView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.text()).toContain('Armazém Central')
    expect(wrapper.text()).not.toContain('No horário')
    expect(wrapper.text()).not.toContain('Antecipado')
    expect(wrapper.text()).not.toContain('Atrasado')
  })

  it('faz check-in de um agendamento, informando motorista e veículo', async () => {
    vi.mocked(yardVisitService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockVisit], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)
    vi.mocked(yardVisitService.checkIn).mockResolvedValue({
      data: { status: 'success', data: { ...mockVisit, status: 'CHECKED_IN' } },
    } as any)

    const router = makeRouter()
    router.push('/yard/visits')
    await router.isReady()

    const wrapper = mount(YardVisitListView, { global: { plugins: [router] }, attachTo: document.body })
    await flushPromises()

    const checkInButton = wrapper.findAll('button').find((b) => b.text().trim() === 'Fazer Check-in')!
    await checkInButton.trigger('click')
    await wrapper.vm.$nextTick()

    const body = new DOMWrapper(document.body)
    await body.find('#checkin-driver').setValue('drv-1')
    await body.find('#checkin-vehicle').setValue('veh-1')
    await body.find('#checkin-form').trigger('submit.prevent')
    await flushPromises()

    expect(yardVisitService.checkIn).toHaveBeenCalledWith('visit-1', { driverId: 'drv-1', vehicleId: 'veh-1' })
  })

  it('cria um agendamento manual novo', async () => {
    vi.mocked(yardVisitService.getAll).mockResolvedValue({
      data: { status: 'success', data: [], pagination: { page: 1, limit: 100, total: 0, pages: 0 } },
    } as any)
    vi.mocked(yardVisitService.create).mockResolvedValue({ data: { status: 'success', data: mockVisit } } as any)

    const router = makeRouter()
    router.push('/yard/visits')
    await router.isReady()

    const wrapper = mount(YardVisitListView, { global: { plugins: [router] }, attachTo: document.body })
    await flushPromises()

    const novoButton = wrapper.findAll('button').find((b) => b.text().includes('Novo Agendamento'))!
    await novoButton.trigger('click')
    await wrapper.vm.$nextTick()

    const body = new DOMWrapper(document.body)
    await body.find('#visit-form-warehouse').setValue('wh-1')
    await body.find('#visit-form-service-type').setValue('RECEBIMENTO')
    await body.find('#visit-form-supplier').setValue('sup-1')
    await body.find('#visit-form-scheduled-at').setValue('2026-12-01T10:00')
    await body.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(yardVisitService.create).toHaveBeenCalledWith(
      expect.objectContaining({ warehouseId: 'wh-1', serviceType: 'RECEBIMENTO', supplierId: 'sup-1' })
    )
    const manualPayload = vi.mocked(yardVisitService.create).mock.calls[0][0] as any
    expect(manualPayload.driverId).toBeUndefined()
    expect(manualPayload.vehicleId).toBeUndefined()
  })

  it('converte o horário local digitado no formulário para o instante UTC correto ao criar (sem deslocamento de fuso)', async () => {
    vi.mocked(yardVisitService.getAll).mockResolvedValue({
      data: { status: 'success', data: [], pagination: { page: 1, limit: 100, total: 0, pages: 0 } },
    } as any)
    vi.mocked(yardVisitService.create).mockResolvedValue({ data: { status: 'success', data: mockVisit } } as any)

    const router = makeRouter()
    router.push('/yard/visits')
    await router.isReady()

    const wrapper = mount(YardVisitListView, { global: { plugins: [router] }, attachTo: document.body })
    await flushPromises()

    const novoButton = wrapper.findAll('button').find((b) => b.text().includes('Novo Agendamento'))!
    await novoButton.trigger('click')
    await wrapper.vm.$nextTick()

    const body = new DOMWrapper(document.body)
    await body.find('#visit-form-warehouse').setValue('wh-1')
    await body.find('#visit-form-service-type').setValue('RECEBIMENTO')
    await body.find('#visit-form-supplier').setValue('sup-1')
    await body.find('#visit-form-scheduled-at').setValue('2026-12-01T10:00')
    await body.find('form').trigger('submit.prevent')
    await flushPromises()

    const payload = vi.mocked(yardVisitService.create).mock.calls[0][0] as any
    // O valor mandado deve ser o ISO UTC correspondente ao horário LOCAL digitado
    // (mesma referência de instante que new Date('2026-12-01T10:00') produz no
    // ambiente de teste), não a string naive cortada direto do input.
    expect(new Date(payload.scheduledAt).getTime()).toBe(new Date('2026-12-01T10:00').getTime())
  })

  it('faz check-in direto (walk-in), informando motorista e veículo no próprio agendamento', async () => {
    vi.mocked(yardVisitService.getAll).mockResolvedValue({
      data: { status: 'success', data: [], pagination: { page: 1, limit: 100, total: 0, pages: 0 } },
    } as any)
    vi.mocked(yardVisitService.create).mockResolvedValue({ data: { status: 'success', data: mockVisit } } as any)

    const router = makeRouter()
    router.push('/yard/visits')
    await router.isReady()

    const wrapper = mount(YardVisitListView, { global: { plugins: [router] }, attachTo: document.body })
    await flushPromises()

    const walkInButton = wrapper.findAll('button').find((b) => b.text().includes('Check-in Direto'))!
    await walkInButton.trigger('click')
    await wrapper.vm.$nextTick()

    const body = new DOMWrapper(document.body)
    await body.find('#visit-form-warehouse').setValue('wh-1')
    await body.find('#visit-form-service-type').setValue('RECEBIMENTO')
    await body.find('#visit-form-supplier').setValue('sup-1')
    await body.find('#visit-form-scheduled-at').setValue('2026-12-01T10:00')
    await body.find('#visit-form-driver').setValue(mockDriver.id)
    await body.find('#visit-form-vehicle').setValue(mockVehicle.id)
    await body.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(yardVisitService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        warehouseId: 'wh-1',
        serviceType: 'RECEBIMENTO',
        supplierId: 'sup-1',
        driverId: mockDriver.id,
        vehicleId: mockVehicle.id,
      })
    )
  })

  it('edita um agendamento existente, sem exigir motorista/veículo', async () => {
    vi.mocked(yardVisitService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockVisit], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)
    vi.mocked(yardVisitService.update).mockResolvedValue({ data: { status: 'success', data: mockVisit } } as any)

    const router = makeRouter()
    router.push('/yard/visits')
    await router.isReady()

    const wrapper = mount(YardVisitListView, { global: { plugins: [router] }, attachTo: document.body })
    await flushPromises()

    const editButton = wrapper.findAll('button').find((b) => b.text().trim() === 'Editar')!
    await editButton.trigger('click')
    await wrapper.vm.$nextTick()

    const body = new DOMWrapper(document.body)
    await body.find('#visit-form-notes').setValue('Chegada pelo portão 2')
    await body.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(yardVisitService.update).toHaveBeenCalledWith(
      'visit-1',
      expect.objectContaining({ notes: 'Chegada pelo portão 2' })
    )
  })

  it('aloca uma visita CHECKED_IN numa vaga livre', async () => {
    const checkedInVisit = { ...mockVisit, status: 'CHECKED_IN', driverId: 'drv-1', vehicleId: 'veh-1', driver: { id: 'drv-1', name: 'João da Silva' }, vehicle: { id: 'veh-1', plate: 'ABC1D23' } }
    vi.mocked(yardVisitService.getAll).mockResolvedValue({
      data: { status: 'success', data: [checkedInVisit], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)
    vi.mocked(yardVisitService.allocateSpot).mockResolvedValue({ data: { status: 'success', data: { ...checkedInVisit, status: 'IN_YARD' } } } as any)

    const router = makeRouter()
    router.push('/yard/visits')
    await router.isReady()

    const wrapper = mount(YardVisitListView, { global: { plugins: [router] }, attachTo: document.body })
    await flushPromises()

    const allocateButton = wrapper.findAll('button').find((b) => b.text().trim() === 'Alocar Vaga')!
    await allocateButton.trigger('click')
    await wrapper.vm.$nextTick()

    const body = new DOMWrapper(document.body)
    await body.find('#allocate-spot-select').setValue('spot-1')
    await body.find('#allocate-spot-form').trigger('submit.prevent')
    await flushPromises()

    expect(yardVisitService.allocateSpot).toHaveBeenCalledWith('visit-1', 'spot-1')
  })
})
