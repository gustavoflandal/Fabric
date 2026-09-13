import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { setActivePinia, createPinia } from 'pinia'
import YardDashboardView from '../YardDashboardView.vue'
import yardDashboardService from '@/services/yard-dashboard.service'
import warehouseService from '@/services/warehouse.service'

vi.mock('@/services/yard-dashboard.service', () => ({
  default: { getDashboard: vi.fn() },
}))
vi.mock('@/services/warehouse.service', () => ({ default: { getAll: vi.fn() } }))
vi.mock('@/stores/auth.store', () => ({ useAuthStore: () => ({ userName: 'Teste', logout: vi.fn() }) }))
vi.mock('@/stores/theme.store', () => ({ useThemeStore: () => ({ mode: 'system', isDark: false, setMode: vi.fn() }) }))

const mockWarehouse = { id: 'wh-1', code: 'WH-1', name: 'Armazém Central', active: true, createdAt: '', updatedAt: '' }

const mockDashboard = {
  mode: 'REALTIME',
  totals: { portaria: 2, patio: 1, doca: 3 },
  occupancy: { patioPercent: 10, docaPercent: 60, patioRatio: '1/10', docaRatio: '3/5' },
  visits: [
    {
      id: 'visit-1', plate: 'ABC1D23', driverName: 'João da Silva', vehicleModel: 'Volvo FH',
      serviceType: 'RECEBIMENTO', supplierName: 'Transportadora Alfa', origin: 'MANUAL',
      currentLocation: 'DOCA', scheduledAt: new Date().toISOString(), punctuality: 'NO_HORARIO',
      performedBy: 'Admin', notes: null, totalDurationMinutes: null,
    },
  ],
}

function makeRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/yard/dashboard', component: YardDashboardView },
      { path: '/login', component: { template: '<div />' } },
    ],
  })
}

describe('YardDashboardView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    vi.mocked(warehouseService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockWarehouse], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)
  })

  it('carrega o dashboard do primeiro armazém e exibe totais, ocupação e a grade', async () => {
    vi.mocked(yardDashboardService.getDashboard).mockResolvedValue({ data: { status: 'success', data: mockDashboard } } as any)

    const router = makeRouter()
    router.push('/yard/dashboard')
    await router.isReady()

    const wrapper = mount(YardDashboardView, { global: { plugins: [router] } })
    await flushPromises()

    expect(yardDashboardService.getDashboard).toHaveBeenCalledWith('wh-1', undefined)
    expect(wrapper.text()).toContain('ABC1D23')
    expect(wrapper.text()).toContain('João da Silva')
    expect(wrapper.text()).toContain('Volvo FH')
    expect(wrapper.text()).toContain('1/10')
  })

  it('recarrega com o período (days) quando o usuário escolhe o modo histórico', async () => {
    vi.mocked(yardDashboardService.getDashboard).mockResolvedValue({ data: { status: 'success', data: mockDashboard } } as any)

    const router = makeRouter()
    router.push('/yard/dashboard')
    await router.isReady()

    const wrapper = mount(YardDashboardView, { global: { plugins: [router] } })
    await flushPromises()

    await wrapper.find('#dashboard-days-select').setValue('30')
    await flushPromises()

    expect(yardDashboardService.getDashboard).toHaveBeenCalledWith('wh-1', 30)
  })
})
