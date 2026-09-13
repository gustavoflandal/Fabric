import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { setActivePinia, createPinia } from 'pinia'
import PurchaseQuotationsView from '../PurchaseQuotationsView.vue'
import purchaseQuotationService from '@/services/purchase-quotation.service'

vi.mock('@/services/purchase-quotation.service', () => ({
  default: {
    getAll: vi.fn(),
    getById: vi.fn(),
    approve: vi.fn(),
    reject: vi.fn(),
  },
}))
vi.mock('@/services/purchase-order.service', () => ({
  default: { createFromQuotation: vi.fn() },
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

const mockQuotationReceived = {
  id: 'quot-1', quotationNumber: 'ORC-2026-0001', supplierId: 'sup-1', requestDate: '2026-09-01', dueDate: '2026-09-15',
  status: 'RECEIVED', totalValue: 1000, createdBy: 'u1', createdAt: '', updatedAt: '',
  supplier: { id: 'sup-1', code: 'F001', name: 'Fornecedor A' }, items: [],
}

function makeRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/purchases/quotations', component: PurchaseQuotationsView },
      { path: '/login', component: { template: '<div />' } },
    ],
  })
}

async function mountView() {
  const router = makeRouter()
  router.push('/purchases/quotations')
  await router.isReady()
  const wrapper = mount(PurchaseQuotationsView, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

describe('PurchaseQuotationsView — fluxo de aprovação/rejeição', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({ data: { data: [] } }) }))
    vi.mocked(purchaseQuotationService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockQuotationReceived], pagination: { page: 1, limit: 20, total: 1, pages: 1 } },
    } as any)
  })

  it('mostra "Aprovar" e "Rejeitar" para um orçamento Recebido, e chama o endpoint de aprovação', async () => {
    const wrapper = await mountView()

    const row = wrapper.findAll('tr').find((r) => r.text().includes('ORC-2026-0001'))!
    expect(row.text()).toContain('Aprovar')
    expect(row.text()).toContain('Rejeitar')

    vi.mocked(purchaseQuotationService.approve).mockResolvedValue({ data: { status: 'success', data: {} } } as any)
    const approveBtn = row.findAll('button').find((b) => b.text() === 'Aprovar')!
    await approveBtn.trigger('click')
    await flushPromises()

    expect(purchaseQuotationService.approve).toHaveBeenCalledWith('quot-1')
  })

  it('chama o endpoint de rejeição ao clicar em "Rejeitar"', async () => {
    const wrapper = await mountView()
    vi.mocked(purchaseQuotationService.reject).mockResolvedValue({ data: { status: 'success', data: {} } } as any)

    const row = wrapper.findAll('tr').find((r) => r.text().includes('ORC-2026-0001'))!
    const rejectBtn = row.findAll('button').find((b) => b.text() === 'Rejeitar')!
    await rejectBtn.trigger('click')
    await flushPromises()

    expect(purchaseQuotationService.reject).toHaveBeenCalledWith('quot-1')
  })

  it('não mostra "Aprovar"/"Rejeitar" para um orçamento já Aprovado (mostra "Gerar Pedido" em vez disso)', async () => {
    vi.mocked(purchaseQuotationService.getAll).mockResolvedValue({
      data: { status: 'success', data: [{ ...mockQuotationReceived, status: 'APPROVED' }], pagination: { page: 1, limit: 20, total: 1, pages: 1 } },
    } as any)
    const wrapper = await mountView()

    const row = wrapper.findAll('tr').find((r) => r.text().includes('ORC-2026-0001'))!
    expect(row.text()).not.toContain('Aprovar')
    expect(row.text()).not.toContain('Rejeitar')
    expect(row.text()).toContain('Gerar Pedido')
  })
})
