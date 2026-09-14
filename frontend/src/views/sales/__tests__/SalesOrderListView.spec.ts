import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises, DOMWrapper } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { setActivePinia, createPinia } from 'pinia'
import SalesOrderListView from '../SalesOrderListView.vue'
import salesOrderService from '@/services/sales-order.service'
import customerService from '@/services/customer.service'
import productService from '@/services/product.service'
import warehouseService from '@/services/warehouse.service'
import { useToast } from '@/composables/useToast'

vi.mock('@/services/sales-order.service', () => ({
  default: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    confirm: vi.fn(),
    cancel: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('@/services/customer.service', () => ({ default: { getAll: vi.fn() } }))
vi.mock('@/services/product.service', () => ({ default: { getAll: vi.fn() } }))
vi.mock('@/services/warehouse.service', () => ({ default: { getAll: vi.fn() } }))

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ userName: 'Teste', logout: vi.fn() }),
}))
vi.mock('@/stores/theme.store', () => ({
  useThemeStore: () => ({ mode: 'system', isDark: false, setMode: vi.fn() }),
}))

// `confirmDialog` depende de um `<ConfirmDialogContainer />` montado em App.vue
// (fora do escopo deste teste) — mesmo mock das demais telas com confirmação.
vi.mock('@/composables/useConfirm', () => ({
  confirmDialog: vi.fn().mockResolvedValue(true),
}))

const customerA = { id: 'cust-1', code: 'C001', name: 'Cliente Um', active: true }
const warehouseA = { id: 'wh-1', code: 'WH1', name: 'Armazém 1', active: true }
const productA = {
  id: 'prod-1',
  code: 'P001',
  name: 'Produto Um',
  type: 'FINISHED',
  unitId: 'un-1',
  leadTime: 0,
  minStock: 0,
  safetyStock: 0,
  lotTracked: false,
  active: true,
}

// Shape real de `GET /sales-orders` (sales-order.service.ts::orderInclude).
const draftOrder = {
  id: 'so-1',
  orderNumber: 'PV-2026-000001',
  customerId: 'cust-1',
  warehouseId: 'wh-1',
  status: 'DRAFT',
  orderDate: '2026-09-10T12:00:00.000Z',
  expectedShipDate: '2026-09-20T00:00:00.000Z',
  totalValue: 50,
  notes: null,
  createdBy: 'u1',
  createdAt: '2026-09-10T12:00:00.000Z',
  updatedAt: '2026-09-10T12:00:00.000Z',
  customer: { id: 'cust-1', code: 'C001', name: 'Cliente Um', document: null },
  warehouse: { id: 'wh-1', code: 'WH1', name: 'Armazém 1' },
  creator: { id: 'u1', name: 'Admin', email: 'a@a.com' },
  items: [
    {
      id: 'soi-1',
      orderId: 'so-1',
      productId: 'prod-1',
      quantity: 5,
      unitPrice: 10,
      totalPrice: 50,
      pickedQty: 0,
      shippedQty: 0,
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

const shippedOrder = {
  ...draftOrder,
  id: 'so-2',
  orderNumber: 'PV-2026-000002',
  status: 'SHIPPED',
  items: [{ ...draftOrder.items[0], id: 'soi-2', orderId: 'so-2', shippedQty: 5 }],
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
      { path: '/sales-orders', component: SalesOrderListView },
      { path: '/shipments', component: { template: '<div />' } },
      { path: '/login', component: { template: '<div />' } },
    ],
  })
}

async function mountView() {
  const router = makeRouter()
  router.push('/sales-orders')
  await router.isReady()
  // attachTo: document.body — AppModal renderiza via Teleport(to: 'body').
  const wrapper = mount(SalesOrderListView, {
    global: { plugins: [router] },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

describe('SalesOrderListView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    document.body.innerHTML = ''
    useToast().toasts.splice(0)

    vi.mocked(customerService.getAll).mockResolvedValue(listResponse([customerA]))
    vi.mocked(productService.getAll).mockResolvedValue(listResponse([productA]))
    vi.mocked(warehouseService.getAll).mockResolvedValue({ data: { data: [warehouseA] } } as any)
    vi.mocked(salesOrderService.getAll).mockResolvedValue(listResponse([draftOrder, shippedOrder]))
  })

  it('lista os pedidos devolvidos pelo service', async () => {
    const wrapper = await mountView()

    expect(salesOrderService.getAll).toHaveBeenCalledWith(1, 20, {})
    expect(wrapper.text()).toContain('PV-2026-000001')
    expect(wrapper.text()).toContain('PV-2026-000002')
    expect(wrapper.text()).toContain('Cliente Um')
    expect(wrapper.text()).toContain('Rascunho')
    expect(wrapper.text()).toContain('Expedido')
  })

  it('mostra o estado vazio do DataTable quando não há pedidos', async () => {
    vi.mocked(salesOrderService.getAll).mockResolvedValue(listResponse([], 0))

    const wrapper = await mountView()

    expect(wrapper.text()).toContain('Nenhum pedido de venda encontrado')
    expect(wrapper.find('table').exists()).toBe(false)
  })

  it('mostra o estado de erro do DataTable quando a busca falha', async () => {
    vi.mocked(salesOrderService.getAll).mockRejectedValue({
      response: { data: { message: 'Módulo EXPEDICAO não habilitado' } },
    })

    const wrapper = await mountView()

    expect(wrapper.text()).toContain('Módulo EXPEDICAO não habilitado')
    expect(wrapper.text()).toContain('Tentar Novamente')
    expect(wrapper.find('table').exists()).toBe(false)
  })

  it('o filtro de status dispara nova busca com o status escolhido', async () => {
    const wrapper = await mountView()
    vi.mocked(salesOrderService.getAll).mockClear()

    await wrapper.find('#so-filter-status').setValue('CONFIRMED')
    await flushPromises()

    expect(salesOrderService.getAll).toHaveBeenCalledWith(1, 20, { status: 'CONFIRMED' })
  })

  it('"Confirmar" chama o service com o id do pedido e recarrega a lista', async () => {
    vi.mocked(salesOrderService.confirm).mockResolvedValue({
      data: { data: { ...draftOrder, status: 'CONFIRMED' } },
    } as any)

    const wrapper = await mountView()

    const row = wrapper.findAll('tr').find((r) => r.text().includes('PV-2026-000001'))!
    const confirmBtn = row.findAll('button').find((b) => b.text() === 'Confirmar')!
    await confirmBtn.trigger('click')
    await flushPromises()

    expect(salesOrderService.confirm).toHaveBeenCalledWith('so-1')
    expect(salesOrderService.getAll).toHaveBeenCalledTimes(2)
    expect(
      useToast().toasts.some(
        (t) => t.type === 'success' && t.message === 'Pedido confirmado com sucesso!'
      )
    ).toBe(true)
  })

  it('não oferece Editar/Confirmar/Cancelar para um pedido já expedido', async () => {
    const wrapper = await mountView()

    const row = wrapper.findAll('tr').find((r) => r.text().includes('PV-2026-000002'))!
    const labels = row.findAll('button').map((b) => b.text())
    expect(labels).not.toContain('Editar')
    expect(labels).not.toContain('Confirmar')
    expect(labels).not.toContain('Cancelar')
  })

  it('"Cancelar" chama o service com o id do pedido', async () => {
    vi.mocked(salesOrderService.cancel).mockResolvedValue({
      data: { data: { ...draftOrder, status: 'CANCELLED' } },
    } as any)

    const wrapper = await mountView()

    const row = wrapper.findAll('tr').find((r) => r.text().includes('PV-2026-000001'))!
    const cancelBtn = row.findAll('button').find((b) => b.text() === 'Cancelar')!
    await cancelBtn.trigger('click')
    await flushPromises()

    expect(salesOrderService.cancel).toHaveBeenCalledWith('so-1')
  })

  it('o modal de novo pedido chama create com cliente, armazém e itens preenchidos', async () => {
    vi.mocked(salesOrderService.create).mockResolvedValue({
      data: { data: draftOrder },
    } as any)

    const wrapper = await mountView()

    const novoBtn = wrapper.findAll('button').find((b) => b.text().includes('Novo Pedido'))!
    await novoBtn.trigger('click')
    await wrapper.vm.$nextTick()

    const body = new DOMWrapper(document.body)
    expect(body.find('[role="dialog"]').exists()).toBe(true)

    await body.find('#so-form-customer').setValue('cust-1')
    await body.find('#so-form-warehouse').setValue('wh-1')
    await body.find('#so-form-item-product-0').setValue('prod-1')
    await body.find('#so-form-item-quantity-0').setValue(5)
    await body.find('#so-form-item-price-0').setValue(10)

    await body.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(salesOrderService.create).toHaveBeenCalledWith({
      customerId: 'cust-1',
      warehouseId: 'wh-1',
      expectedShipDate: null,
      notes: null,
      items: [{ productId: 'prod-1', quantity: 5, unitPrice: 10 }],
    })
    expect(body.find('[role="dialog"]').exists()).toBe(false)
  })

  it('o modal de edição pré-carrega o pedido e chama update com a lista de itens substituída', async () => {
    vi.mocked(salesOrderService.update).mockResolvedValue({
      data: { data: draftOrder },
    } as any)

    const wrapper = await mountView()

    const row = wrapper.findAll('tr').find((r) => r.text().includes('PV-2026-000001'))!
    const editBtn = row.findAll('button').find((b) => b.text() === 'Editar')!
    await editBtn.trigger('click')
    await wrapper.vm.$nextTick()

    const body = new DOMWrapper(document.body)
    expect((body.find('#so-form-customer').element as HTMLSelectElement).value).toBe('cust-1')
    expect((body.find('#so-form-item-quantity-0').element as HTMLInputElement).value).toBe('5')

    await body.find('#so-form-item-quantity-0').setValue(8)
    await body.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(salesOrderService.update).toHaveBeenCalledWith('so-1', {
      customerId: 'cust-1',
      warehouseId: 'wh-1',
      expectedShipDate: '2026-09-20',
      notes: null,
      items: [{ productId: 'prod-1', quantity: 8, unitPrice: 10 }],
    })
  })
})
