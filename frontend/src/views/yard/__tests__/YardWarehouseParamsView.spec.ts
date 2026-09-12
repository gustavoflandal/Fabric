import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { setActivePinia, createPinia } from 'pinia'
import YardWarehouseParamsView from '../YardWarehouseParamsView.vue'
import yardWarehouseParamsService from '@/services/yard-warehouse-params.service'
import warehouseService from '@/services/warehouse.service'

vi.mock('@/services/yard-warehouse-params.service', () => ({
  default: { getByWarehouseId: vi.fn(), upsert: vi.fn() },
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

function makeRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/yard/warehouse-params', component: YardWarehouseParamsView },
      { path: '/login', component: { template: '<div />' } },
    ],
  })
}

describe('YardWarehouseParamsView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    vi.mocked(warehouseService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockWarehouse], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)
  })

  it('carrega os parâmetros do primeiro armazém ao montar', async () => {
    vi.mocked(yardWarehouseParamsService.getByWarehouseId).mockResolvedValue({
      data: { status: 'success', data: { id: null, warehouseId: 'wh-1', useYard: true, delayToleranceMinutes: 15, createdAt: null, updatedAt: null } },
    } as any)

    const router = makeRouter()
    router.push('/yard/warehouse-params')
    await router.isReady()

    const wrapper = mount(YardWarehouseParamsView, { global: { plugins: [router] } })
    await flushPromises()

    expect(yardWarehouseParamsService.getByWarehouseId).toHaveBeenCalledWith('wh-1')
    const toleranceInput = wrapper.find('#yard-params-tolerance').element as HTMLInputElement
    expect(toleranceInput.value).toBe('15')
  })

  it('salva os parâmetros alterados', async () => {
    vi.mocked(yardWarehouseParamsService.getByWarehouseId).mockResolvedValue({
      data: { status: 'success', data: { id: null, warehouseId: 'wh-1', useYard: true, delayToleranceMinutes: 15, createdAt: null, updatedAt: null } },
    } as any)
    vi.mocked(yardWarehouseParamsService.upsert).mockResolvedValue({
      data: { status: 'success', data: { id: 'params-1', warehouseId: 'wh-1', useYard: false, delayToleranceMinutes: 30, createdAt: '', updatedAt: '' } },
    } as any)

    const router = makeRouter()
    router.push('/yard/warehouse-params')
    await router.isReady()

    const wrapper = mount(YardWarehouseParamsView, { global: { plugins: [router] } })
    await flushPromises()

    await wrapper.find('#yard-params-use-yard').setValue(false)
    await wrapper.find('#yard-params-tolerance').setValue('30')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(yardWarehouseParamsService.upsert).toHaveBeenCalledWith('wh-1', { useYard: false, delayToleranceMinutes: 30 })
  })
})
