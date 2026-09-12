import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, DOMWrapper } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { setActivePinia, createPinia } from 'pinia'
import DriverListView from '../DriverListView.vue'
import driverService from '@/services/driver.service'
import supplierService from '@/services/supplier.service'

vi.mock('@/services/driver.service', () => ({
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

const mockDriver = {
  id: 'drv-1',
  name: 'João da Silva',
  cpf: '12345678901',
  supplierId: 'sup-1',
  blocked: false,
  blockedReason: null,
  createdAt: '',
  updatedAt: '',
  supplier: { id: 'sup-1', code: 'SUP-1', name: 'Transportadora Alfa' },
}

function makeRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/yard/drivers', component: DriverListView },
      { path: '/login', component: { template: '<div />' } },
    ],
  })
}

describe('DriverListView', () => {
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

  it('carrega e exibe a lista de motoristas', async () => {
    vi.mocked(driverService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockDriver], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)

    const router = makeRouter()
    router.push('/yard/drivers')
    await router.isReady()

    const wrapper = mount(DriverListView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.text()).toContain('João da Silva')
    expect(wrapper.text()).toContain('Transportadora Alfa')
  })

  it('bloqueia um motorista informando o motivo', async () => {
    vi.mocked(driverService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockDriver], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)
    vi.mocked(driverService.setBlocked).mockResolvedValue({ data: { status: 'success', data: { ...mockDriver, blocked: true } } } as any)

    const router = makeRouter()
    router.push('/yard/drivers')
    await router.isReady()

    const wrapper = mount(DriverListView, { global: { plugins: [router] }, attachTo: document.body })
    await flushPromises()

    const blockButton = wrapper.findAll('button').find((b) => b.text().trim() === 'Bloquear')!
    await blockButton.trigger('click')
    await wrapper.vm.$nextTick()

    const body = new DOMWrapper(document.body)
    await body.find('#driver-block-reason').setValue('CNH vencida')
    await body.find('#driver-block-form').trigger('submit.prevent')
    await flushPromises()

    expect(driverService.setBlocked).toHaveBeenCalledWith('drv-1', true, 'CNH vencida')
  })
})
