import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { setActivePinia, createPinia } from 'pinia'
import PurchaseOrdersView from '../PurchaseOrdersView.vue'
import purchaseOrderService from '@/services/purchase-order.service'

vi.mock('@/services/purchase-order.service', () => ({
  default: {
    getAll: vi.fn(),
    getById: vi.fn(),
    approve: vi.fn(),
    confirm: vi.fn(),
    cancel: vi.fn(),
  },
}))

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ userName: 'Teste', logout: vi.fn() }),
}))
vi.mock('@/stores/theme.store', () => ({
  useThemeStore: () => ({ mode: 'system', isDark: false, setMode: vi.fn() }),
}))
vi.mock('@/composables/useConfirm', () => ({
  confirmDialog: vi.fn().mockResolvedValue(true),
}))

const mockOrderPending = {
  id: 'order-1', orderNumber: 'PC-2026-0001', supplierId: 'sup-1', orderDate: '2026-09-01', expectedDate: '2026-09-15',
  status: 'PENDING', shippingCost: 0, discount: 0, totalValue: 1000, createdBy: 'u1', createdAt: '', updatedAt: '',
  supplier: { id: 'sup-1', code: 'F001', name: 'Fornecedor A' }, items: [],
}

function makeRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/purchases/orders', component: PurchaseOrdersView },
      { path: '/login', component: { template: '<div />' } },
    ],
  })
}

async function mountView() {
  const router = makeRouter()
  router.push('/purchases/orders')
  await router.isReady()
  const wrapper = mount(PurchaseOrdersView, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

describe('PurchaseOrdersView — fluxo de aprovação', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({ data: { data: [] } }) }))
    vi.mocked(purchaseOrderService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockOrderPending], pagination: { page: 1, limit: 1000, total: 1, pages: 1 } },
    } as any)
  })

  it('mostra "Aprovar" (não "Confirmar") para um pedido Pendente, e chama o endpoint de aprovação', async () => {
    const wrapper = await mountView()

    const row = wrapper.findAll('tr').find((r) => r.text().includes('PC-2026-0001'))!
    expect(row.text()).toContain('Aprovar')
    expect(row.text()).not.toContain('Confirmar')

    purchaseOrderService.approve as any
    vi.mocked(purchaseOrderService.approve).mockResolvedValue({ data: { status: 'success', data: {} } } as any)
    const approveBtn = row.findAll('button').find((b) => b.text() === 'Aprovar')!
    await approveBtn.trigger('click')
    await flushPromises()

    expect(purchaseOrderService.approve).toHaveBeenCalledWith('order-1')
  })

  it('mostra "Confirmar" (não "Aprovar") para um pedido já Aprovado, e chama o endpoint de confirmação', async () => {
    vi.mocked(purchaseOrderService.getAll).mockResolvedValue({
      data: { status: 'success', data: [{ ...mockOrderPending, status: 'APPROVED' }], pagination: { page: 1, limit: 1000, total: 1, pages: 1 } },
    } as any)
    const wrapper = await mountView()

    const row = wrapper.findAll('tr').find((r) => r.text().includes('PC-2026-0001'))!
    expect(row.text()).toContain('Confirmar')
    expect(row.text()).not.toContain('Aprovar')

    vi.mocked(purchaseOrderService.confirm).mockResolvedValue({ data: { status: 'success', data: {} } } as any)
    const confirmBtn = row.findAll('button').find((b) => b.text() === 'Confirmar')!
    await confirmBtn.trigger('click')
    await flushPromises()

    expect(purchaseOrderService.confirm).toHaveBeenCalledWith('order-1')
  })

  it('badge de status traduz "Aprovado" em vez de mostrar o enum cru', async () => {
    vi.mocked(purchaseOrderService.getAll).mockResolvedValue({
      data: { status: 'success', data: [{ ...mockOrderPending, status: 'APPROVED' }], pagination: { page: 1, limit: 1000, total: 1, pages: 1 } },
    } as any)
    const wrapper = await mountView()

    expect(wrapper.text()).toContain('Aprovado')
    expect(wrapper.text()).not.toContain('APPROVED')
  })

  it('filtro de status inclui a opção "Aprovado"', async () => {
    const wrapper = await mountView()
    const options = wrapper.find('#pos-filter-status').findAll('option').map((o) => o.attributes('value'))
    expect(options).toContain('APPROVED')
  })
})
