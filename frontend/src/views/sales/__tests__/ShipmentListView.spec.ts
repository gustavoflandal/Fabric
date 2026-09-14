import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises, DOMWrapper } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { setActivePinia, createPinia } from 'pinia'
import ShipmentListView from '../ShipmentListView.vue'
import shipmentService from '@/services/shipment.service'
import salesOrderService from '@/services/sales-order.service'
import warehouseService from '@/services/warehouse.service'
import { useToast } from '@/composables/useToast'

vi.mock('@/services/shipment.service', () => ({
  default: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    startSeparation: vi.fn(),
    dispatch: vi.fn(),
    cancel: vi.fn(),
  },
}))

vi.mock('@/services/sales-order.service', () => ({ default: { getAll: vi.fn() } }))
vi.mock('@/services/warehouse.service', () => ({ default: { getAll: vi.fn() } }))

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ userName: 'Teste', logout: vi.fn() }),
}))
vi.mock('@/stores/theme.store', () => ({
  useThemeStore: () => ({ mode: 'system', isDark: false, setMode: vi.fn() }),
}))

vi.mock('@/composables/useConfirm', () => ({
  confirmDialog: vi.fn().mockResolvedValue(true),
}))

const warehouseA = { id: 'wh-1', code: 'WH1', name: 'Armazém 1', active: true }

// Pedido CONFIRMADO com 10 pedidos e 4 já expedidos — o saldo de 6 é o que a
// tela pré-preenche na linha do romaneio.
const confirmedOrder = {
  id: 'so-1',
  orderNumber: 'PV-2026-000001',
  customerId: 'cust-1',
  warehouseId: 'wh-1',
  status: 'CONFIRMED',
  orderDate: '2026-09-10T12:00:00.000Z',
  expectedShipDate: null,
  totalValue: 100,
  notes: null,
  createdBy: 'u1',
  createdAt: '2026-09-10T12:00:00.000Z',
  updatedAt: '2026-09-10T12:00:00.000Z',
  customer: { id: 'cust-1', code: 'C001', name: 'Cliente Um', document: null },
  warehouse: { id: 'wh-1', code: 'WH1', name: 'Armazém 1' },
  items: [
    {
      id: 'soi-1',
      orderId: 'so-1',
      productId: 'prod-1',
      quantity: 10,
      unitPrice: 10,
      totalPrice: 100,
      pickedQty: 0,
      shippedQty: 4,
      product: {
        id: 'prod-1',
        code: 'P001',
        name: 'Produto Um',
        lotTracked: false,
        unit: { id: 'un-1', code: 'UN', symbol: 'un' },
      },
    },
  ],
  shipments: [],
}

// Shape real de `GET /shipments` (shipment.service.ts::shipmentInclude).
const pendingShipment = {
  id: 'sh-1',
  shipmentNumber: 'EXP-2026-000001',
  salesOrderId: 'so-1',
  warehouseId: 'wh-1',
  status: 'PENDING',
  dispatchedAt: null,
  notes: null,
  createdBy: 'u1',
  createdAt: '2026-09-11T10:00:00.000Z',
  updatedAt: '2026-09-11T10:00:00.000Z',
  salesOrder: {
    id: 'so-1',
    orderNumber: 'PV-2026-000001',
    status: 'CONFIRMED',
    customer: { id: 'cust-1', code: 'C001', name: 'Cliente Um', document: null },
  },
  warehouse: { id: 'wh-1', code: 'WH1', name: 'Armazém 1' },
  creator: { id: 'u1', name: 'Admin', email: 'a@a.com' },
  items: [
    {
      id: 'shi-1',
      shipmentId: 'sh-1',
      salesOrderItemId: 'soi-1',
      productId: 'prod-1',
      quantity: 6,
      lotId: null,
      product: {
        id: 'prod-1',
        code: 'P001',
        name: 'Produto Um',
        lotTracked: false,
        unit: { id: 'un-1', code: 'UN', symbol: 'un' },
      },
      salesOrderItem: { id: 'soi-1', quantity: 10, pickedQty: 0, shippedQty: 4 },
      lot: null,
    },
  ],
}

const dispatchedShipment = {
  ...pendingShipment,
  id: 'sh-2',
  shipmentNumber: 'EXP-2026-000002',
  status: 'DISPATCHED',
  dispatchedAt: '2026-09-12T15:00:00.000Z',
}

function listResponse(data: unknown[], total = data.length) {
  return {
    data: {
      status: 'success',
      data,
      pagination: { page: 1, limit: 20, total, pages: total === 0 ? 0 : 1 },
    },
  } as any
}

function makeRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/shipments', component: ShipmentListView },
      { path: '/shipments/:id', component: { template: '<div />' } },
      { path: '/login', component: { template: '<div />' } },
    ],
  })
}

async function mountView(query = '') {
  const router = makeRouter()
  router.push(`/shipments${query}`)
  await router.isReady()
  const wrapper = mount(ShipmentListView, {
    global: { plugins: [router] },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

describe('ShipmentListView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    document.body.innerHTML = ''
    useToast().toasts.splice(0)

    vi.mocked(warehouseService.getAll).mockResolvedValue({ data: { data: [warehouseA] } } as any)
    // `fetchShippableOrders` consulta CONFIRMED e SEPARATING separadamente —
    // `GET /sales-orders` só filtra por UM status por vez.
    vi.mocked(salesOrderService.getAll).mockImplementation((_page, _limit, filters) =>
      Promise.resolve(
        filters?.status === 'CONFIRMED' ? listResponse([confirmedOrder]) : listResponse([])
      )
    )
    vi.mocked(shipmentService.getAll).mockResolvedValue(
      listResponse([pendingShipment, dispatchedShipment])
    )
  })

  it('lista os romaneios devolvidos pelo service', async () => {
    const wrapper = await mountView()

    expect(shipmentService.getAll).toHaveBeenCalledWith(1, 20, {})
    expect(wrapper.text()).toContain('EXP-2026-000001')
    expect(wrapper.text()).toContain('EXP-2026-000002')
    expect(wrapper.text()).toContain('PV-2026-000001')
    expect(wrapper.text()).toContain('Pendente')
    expect(wrapper.text()).toContain('Despachado')
  })

  it('mostra o estado vazio do DataTable quando não há romaneios', async () => {
    vi.mocked(shipmentService.getAll).mockResolvedValue(listResponse([], 0))

    const wrapper = await mountView()

    expect(wrapper.text()).toContain('Nenhum romaneio encontrado')
    expect(wrapper.find('table').exists()).toBe(false)
  })

  it('mostra o estado de erro do DataTable quando a busca falha', async () => {
    vi.mocked(shipmentService.getAll).mockRejectedValue({
      response: { data: { message: 'Sem permissão para visualizar romaneios' } },
    })

    const wrapper = await mountView()

    expect(wrapper.text()).toContain('Sem permissão para visualizar romaneios')
    expect(wrapper.text()).toContain('Tentar Novamente')
  })

  it('o filtro de status dispara nova busca com o status escolhido', async () => {
    const wrapper = await mountView()
    vi.mocked(shipmentService.getAll).mockClear()

    await wrapper.find('#sh-filter-status').setValue('SEPARATING')
    await flushPromises()

    expect(shipmentService.getAll).toHaveBeenCalledWith(1, 20, { status: 'SEPARATING' })
  })

  it('o salesOrderId da URL já entra como filtro na primeira busca', async () => {
    await mountView('?salesOrderId=so-1')

    expect(shipmentService.getAll).toHaveBeenCalledWith(1, 20, { salesOrderId: 'so-1' })
  })

  it('"Criar Romaneio" chama create com o pedido e a quantidade parcial informada', async () => {
    vi.mocked(shipmentService.create).mockResolvedValue({ data: { data: pendingShipment } } as any)

    const wrapper = await mountView()

    const criarBtn = wrapper.findAll('button').find((b) => b.text().includes('Criar Romaneio'))!
    await criarBtn.trigger('click')
    await wrapper.vm.$nextTick()

    const body = new DOMWrapper(document.body)
    expect(body.find('[role="dialog"]').exists()).toBe(true)

    await body.find('#sh-form-order').setValue('so-1')
    await flushPromises()

    // Saldo pré-preenchido = pedido (10) - já expedido (4).
    const qtyInput = body.find('[data-testid="sh-form-qty-soi-1"]')
    expect((qtyInput.element as HTMLInputElement).value).toBe('6')

    // Expedição PARCIAL: leva só 2 das 6 disponíveis.
    await qtyInput.setValue(2)
    await body.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(shipmentService.create).toHaveBeenCalledWith({
      salesOrderId: 'so-1',
      notes: null,
      items: [{ salesOrderItemId: 'soi-1', quantity: 2 }],
    })
    expect(body.find('[role="dialog"]').exists()).toBe(false)
    expect(
      useToast().toasts.some(
        (t) => t.type === 'success' && t.message === 'Romaneio criado com sucesso!'
      )
    ).toBe(true)
  })

  it('item com quantidade zero fica de fora do payload e o botão de criar fica desabilitado', async () => {
    const wrapper = await mountView()

    const criarBtn = wrapper.findAll('button').find((b) => b.text().includes('Criar Romaneio'))!
    await criarBtn.trigger('click')
    await wrapper.vm.$nextTick()

    const body = new DOMWrapper(document.body)
    await body.find('#sh-form-order').setValue('so-1')
    await flushPromises()

    await body.find('[data-testid="sh-form-qty-soi-1"]').setValue(0)
    await flushPromises()

    // `button[type="submit"]` e não busca por texto: o botão do cabeçalho da
    // tela também se chama "Criar Romaneio" e vive no mesmo document.body.
    const submitBtn = body.find('form button[type="submit"]')
    expect(submitBtn.attributes('disabled')).toBeDefined()

    await body.find('form').trigger('submit.prevent')
    await flushPromises()
    expect(shipmentService.create).not.toHaveBeenCalled()
  })

  it('"Cancelar" chama o service com o id do romaneio, e não aparece em romaneio despachado', async () => {
    vi.mocked(shipmentService.cancel).mockResolvedValue({
      data: { data: { ...pendingShipment, status: 'CANCELLED' } },
    } as any)

    const wrapper = await mountView()

    const dispatchedRow = wrapper.findAll('tr').find((r) => r.text().includes('EXP-2026-000002'))!
    expect(dispatchedRow.findAll('button').map((b) => b.text())).not.toContain('Cancelar')

    const pendingRow = wrapper.findAll('tr').find((r) => r.text().includes('EXP-2026-000001'))!
    const cancelBtn = pendingRow.findAll('button').find((b) => b.text() === 'Cancelar')!
    await cancelBtn.trigger('click')
    await flushPromises()

    expect(shipmentService.cancel).toHaveBeenCalledWith('sh-1')
  })
})
