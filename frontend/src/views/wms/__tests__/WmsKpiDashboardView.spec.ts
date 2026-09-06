import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import WmsKpiDashboardView from '../WmsKpiDashboardView.vue'
import wmsKpiService from '@/services/wms-kpi.service'

vi.mock('@/services/wms-kpi.service', () => ({
  default: { getTaskKpis: vi.fn(), getOccupancy: vi.fn() },
}))

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ userName: 'Teste', logout: vi.fn() }),
}))

const mockTaskKpis = {
  period: { days: 30 },
  volumeStatus: { byTypeAndStatus: [{ type: 'DESCARGA', status: 'PENDING', count: 3 }], receiptsActive: 2, receiptsFinished: 5 },
  cycleTime: { byType: [{ type: 'DESCARGA', avgHours: 4.5 }], fullReceiptAvgHours: 20.1 },
  productivity: [{ userId: 'u1', userName: 'João', tasksCompleted: 10, avgExecutionHours: 1.2 }],
  bottlenecks: { byType: [{ type: 'QUARENTENA', count: 1 }], affected: [{ receiptId: 'r1', receiptNumber: 'REC-2026-0001', taskType: 'QUARENTENA', hoursStuck: 30 }] },
}

const mockOccupancy = {
  byWarehouse: [{ warehouseCode: 'WH1', occupied: 10, free: 5, blocked: 1, total: 16 }],
}

function makeRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/wms/kpis', component: WmsKpiDashboardView },
      { path: '/login', component: { template: '<div />' } },
    ],
  })
}

describe('WmsKpiDashboardView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('carrega e exibe os KPIs de volume/status e ocupação ao montar', async () => {
    vi.mocked(wmsKpiService.getTaskKpis).mockResolvedValue(mockTaskKpis as any)
    vi.mocked(wmsKpiService.getOccupancy).mockResolvedValue(mockOccupancy as any)

    const router = makeRouter()
    router.push('/wms/kpis')
    await router.isReady()

    const wrapper = mount(WmsKpiDashboardView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wmsKpiService.getTaskKpis).toHaveBeenCalledWith(30)
    expect(wmsKpiService.getOccupancy).toHaveBeenCalled()
    expect(wrapper.text()).toContain('Recebimentos ativos')
  })

  it('troca de aba sem perder os dados já carregados de outra', async () => {
    vi.mocked(wmsKpiService.getTaskKpis).mockResolvedValue(mockTaskKpis as any)
    vi.mocked(wmsKpiService.getOccupancy).mockResolvedValue(mockOccupancy as any)

    const router = makeRouter()
    router.push('/wms/kpis')
    await router.isReady()

    const wrapper = mount(WmsKpiDashboardView, { global: { plugins: [router] } })
    await flushPromises()

    const bottleneckTab = wrapper.findAll('button').find((b) => b.text().includes('Gargalos'))!
    await bottleneckTab.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('REC-2026-0001')
    expect(wmsKpiService.getTaskKpis).toHaveBeenCalledTimes(1)
  })

  it('trocar o período dispara nova chamada a getTaskKpis, não a getOccupancy', async () => {
    vi.mocked(wmsKpiService.getTaskKpis).mockResolvedValue(mockTaskKpis as any)
    vi.mocked(wmsKpiService.getOccupancy).mockResolvedValue(mockOccupancy as any)

    const router = makeRouter()
    router.push('/wms/kpis')
    await router.isReady()

    const wrapper = mount(WmsKpiDashboardView, { global: { plugins: [router] } })
    await flushPromises()

    const select = wrapper.find('select')
    await select.setValue('90')
    await flushPromises()

    expect(wmsKpiService.getTaskKpis).toHaveBeenLastCalledWith(90)
    expect(wmsKpiService.getOccupancy).toHaveBeenCalledTimes(1)
  })
})
