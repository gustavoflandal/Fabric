import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { setActivePinia, createPinia } from 'pinia'
import StockTransferView from '../StockTransferView.vue'
import { storagePositionService } from '@/services/storage-position.service'
import stockService from '@/services/stock.service'
import productService from '@/services/product.service'
import { useToast } from '@/composables/useToast'

vi.mock('@/services/storage-position.service', () => ({
  storagePositionService: {
    getPositionByCode: vi.fn(),
    getMovements: vi.fn(),
  },
}))

vi.mock('@/services/stock.service', () => ({
  default: {
    transfer: vi.fn(),
  },
}))

vi.mock('@/services/product.service', () => ({
  default: {
    getAll: vi.fn(),
  },
}))

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ userName: 'Teste', logout: vi.fn() }),
}))
vi.mock('@/stores/theme.store', () => ({
  useThemeStore: () => ({ mode: 'system', isDark: false, setMode: vi.fn() }),
}))

// `confirmDialog` é baseado em Promise e depende de um `<ConfirmDialogContainer />`
// montado em App.vue (fora do escopo deste teste) — mockado para resolver `true`
// direto, mesmo padrão que outras telas usam para testar fluxos de confirmação.
vi.mock('@/composables/useConfirm', () => ({
  confirmDialog: vi.fn().mockResolvedValue(true),
}))

const productA = {
  id: 'prod-1',
  code: 'P001',
  name: 'Produto Um',
  type: 'RAW_MATERIAL',
  unitId: 'un-1',
  leadTime: 0,
  minStock: 0,
  safetyStock: 0,
  active: true,
  lotTracked: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const positionFrom = {
  id: 'pos-from',
  code: 'ARM-RUA-AA-01',
  warehouseCode: 'WH1',
  streetCode: 'AA',
  floor: 1,
  position: 1,
  blocked: false,
  isPickingArea: false,
  structure: { warehouseId: 'wh-1', warehouse: { code: 'WH1', name: 'Armazém 1' } },
}

const positionTo = {
  ...positionFrom,
  id: 'pos-to',
  code: 'ARM-RUA-AA-02',
}

function makeRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/wms/transfers', component: StockTransferView },
      { path: '/login', component: { template: '<div />' } },
    ],
  })
}

async function mountView() {
  const router = makeRouter()
  router.push('/wms/transfers')
  await router.isReady()
  const wrapper = mount(StockTransferView, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

async function fillBasicForm(wrapper: any) {
  await wrapper.find('#transfer-product').setValue('prod-1')
  await wrapper.find('#transfer-from-code').setValue('ARM-RUA-AA-01')
  await wrapper.find('#transfer-from-code').trigger('blur')
  await flushPromises()
  await wrapper.find('#transfer-to-code').setValue('ARM-RUA-AA-02')
  await wrapper.find('#transfer-to-code').trigger('blur')
  await flushPromises()
  await wrapper.find('#transfer-quantity').setValue(10)
  await wrapper.find('#transfer-reason').setValue('Reorganização de endereço')
}

describe('StockTransferView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    document.body.innerHTML = ''

    vi.mocked(productService.getAll).mockResolvedValue({
      data: { data: [productA] },
    } as any)

    vi.mocked(storagePositionService.getMovements).mockResolvedValue({
      data: { position: { id: 'pos-from' }, movements: [] },
    } as any)

    // `toasts` é estado de módulo compartilhado (useToast.ts) — não é filho da
    // árvore montada aqui (o <ToastContainer /> real vive em App.vue), então
    // as asserções de toast leem esse array diretamente em vez de wrapper.text().
    useToast().toasts.splice(0)
  })

  it('envio bem-sucedido chama stockService.transfer com o payload certo e mostra toast de sucesso', async () => {
    vi.mocked(storagePositionService.getPositionByCode).mockImplementation((code: string) => {
      if (code === 'ARM-RUA-AA-01') return Promise.resolve({ data: positionFrom } as any)
      if (code === 'ARM-RUA-AA-02') return Promise.resolve({ data: positionTo } as any)
      return Promise.reject(new Error('não encontrada'))
    })
    vi.mocked(stockService.transfer).mockResolvedValue({
      id: 'mov-1',
      productId: 'prod-1',
      type: 'ADJUSTMENT',
      quantity: 10,
      reason: 'Reorganização de endereço',
      userId: 'u1',
      createdAt: '2026-09-13T00:00:00.000Z',
    } as any)

    const wrapper = await mountView()
    await fillBasicForm(wrapper)

    const submitBtn = wrapper.findAll('button[type="submit"]')[0]
    expect(submitBtn.attributes('disabled')).toBeUndefined()

    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(stockService.transfer).toHaveBeenCalledWith({
      productId: 'prod-1',
      fromPositionId: 'pos-from',
      toPositionId: 'pos-to',
      quantity: 10,
      reason: 'Reorganização de endereço',
      lotId: undefined,
    })

    expect(useToast().toasts.some((t) => t.type === 'success' && t.message === 'Transferência registrada com sucesso!')).toBe(true)
    // Formulário limpo após sucesso.
    expect((wrapper.find('#transfer-quantity').element as HTMLInputElement).value).toBe('0')
    expect((wrapper.find('#transfer-reason').element as HTMLInputElement).value).toBe('')
  })

  it('erro do backend mostra toast de erro e não limpa o formulário', async () => {
    vi.mocked(storagePositionService.getPositionByCode).mockImplementation((code: string) => {
      if (code === 'ARM-RUA-AA-01') return Promise.resolve({ data: positionFrom } as any)
      if (code === 'ARM-RUA-AA-02') return Promise.resolve({ data: positionTo } as any)
      return Promise.reject(new Error('não encontrada'))
    })
    vi.mocked(stockService.transfer).mockRejectedValue({
      response: { data: { message: 'Estoque insuficiente na posição de origem' } },
    })

    const wrapper = await mountView()
    await fillBasicForm(wrapper)

    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(stockService.transfer).toHaveBeenCalled()
    expect(
      useToast().toasts.some((t) => t.type === 'error' && t.message === 'Estoque insuficiente na posição de origem')
    ).toBe(true)
    // Formulário permanece preenchido após erro.
    expect((wrapper.find('#transfer-reason').element as HTMLInputElement).value).toBe('Reorganização de endereço')
    expect((wrapper.find('#transfer-quantity').element as HTMLInputElement).value).toBe('10')
  })

  it('botão fica desabilitado quando origem e destino resolvem para a mesma posição', async () => {
    vi.mocked(storagePositionService.getPositionByCode).mockResolvedValue({ data: positionFrom } as any)

    const wrapper = await mountView()
    await wrapper.find('#transfer-product').setValue('prod-1')
    await wrapper.find('#transfer-from-code').setValue('ARM-RUA-AA-01')
    await wrapper.find('#transfer-from-code').trigger('blur')
    await flushPromises()
    await wrapper.find('#transfer-to-code').setValue('ARM-RUA-AA-01')
    await wrapper.find('#transfer-to-code').trigger('blur')
    await flushPromises()
    await wrapper.find('#transfer-quantity').setValue(5)
    await wrapper.find('#transfer-reason').setValue('Motivo válido')
    await wrapper.vm.$nextTick()

    const submitBtn = wrapper.findAll('button[type="submit"]')[0]
    expect(submitBtn.attributes('disabled')).toBeDefined()

    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()
    expect(stockService.transfer).not.toHaveBeenCalled()
  })
})
