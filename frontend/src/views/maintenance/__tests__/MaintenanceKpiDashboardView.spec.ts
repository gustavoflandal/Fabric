import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import MaintenanceKpiDashboardView from '../MaintenanceKpiDashboardView.vue'
import maintenanceKpiService from '@/services/maintenance-kpi.service'
import { useThemeStore } from '@/stores/theme.store'

vi.mock('@/services/maintenance-kpi.service', () => ({
  default: { getKpis: vi.fn() },
}))

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ userName: 'Teste', logout: vi.fn() }),
}))

vi.mock('@/stores/theme.store', () => ({
  useThemeStore: vi.fn(() => ({ mode: 'system', isDark: false, setMode: vi.fn() })),
}))

const { chartInstances, MockChart } = vi.hoisted(() => {
  const instances: any[] = []
  class MockChart {
    config: any
    destroy = vi.fn()
    constructor(_target: unknown, config: any) {
      this.config = config
      instances.push(this)
    }
  }
  return { chartInstances: instances, MockChart }
})

vi.mock('chart.js/auto', () => ({ default: MockChart }))

const mockKpis = {
  mttrHours: 3.5,
  preventiveComplianceRate: 80,
  mtbfByEquipment: [
    { equipmentId: 'eq-1', equipmentCode: 'EQP-001', equipmentName: 'Torno CNC 1', mtbfHours: 120 },
    { equipmentId: 'eq-2', equipmentCode: 'EQP-002', equipmentName: 'Prensa 1', mtbfHours: null },
  ],
  ordersByStatusAndType: [
    { status: 'PENDING', type: 'CORRECTIVE', count: 2 },
    { status: 'IN_PROGRESS', type: 'PREVENTIVE', count: 1 },
    { status: 'COMPLETED', type: 'PREVENTIVE', count: 5 },
  ],
}

function makeRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/maintenance/kpis', component: MaintenanceKpiDashboardView },
      { path: '/login', component: { template: '<div />' } },
    ],
  })
}

describe('MaintenanceKpiDashboardView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    chartInstances.length = 0
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('carrega e exibe os KPIs de manutenção', async () => {
    vi.mocked(maintenanceKpiService.getKpis).mockResolvedValue({ data: { status: 'success', data: mockKpis } } as any)

    const router = makeRouter()
    router.push('/maintenance/kpis')
    await router.isReady()

    const wrapper = mount(MaintenanceKpiDashboardView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.text()).toContain('3.5h')
    expect(wrapper.text()).toContain('80%')
    expect(wrapper.text()).toContain('Torno CNC 1')
    expect(wrapper.text()).toContain('Dado insuficiente')
  })

  it('soma PENDING + IN_PROGRESS para "Ordens abertas"', async () => {
    vi.mocked(maintenanceKpiService.getKpis).mockResolvedValue({ data: { status: 'success', data: mockKpis } } as any)

    const router = makeRouter()
    router.push('/maintenance/kpis')
    await router.isReady()

    const wrapper = mount(MaintenanceKpiDashboardView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.text()).toContain('Ordens abertas (pendente + em execução)')
    // 2 (PENDING/CORRECTIVE) + 1 (IN_PROGRESS/PREVENTIVE) = 3; COMPLETED não conta.
    const card = wrapper.findAll('.bg-white').find((c) => c.text().includes('Ordens abertas'))!
    expect(card.text()).toContain('3')
  })

  it('monta o gráfico com as 4 colunas de status e datasets por tipo', async () => {
    vi.mocked(maintenanceKpiService.getKpis).mockResolvedValue({ data: { status: 'success', data: mockKpis } } as any)

    const router = makeRouter()
    router.push('/maintenance/kpis')
    await router.isReady()

    mount(MaintenanceKpiDashboardView, { global: { plugins: [router] } })
    await flushPromises()
    vi.advanceTimersByTime(100)
    await flushPromises()

    expect(chartInstances).toHaveLength(1)
    const [chart] = chartInstances
    expect(chart.config.data.labels).toEqual(['Pendente', 'Em execução', 'Concluída', 'Cancelada'])
    const datasets = Object.fromEntries(chart.config.data.datasets.map((d: any) => [d.label, d.data]))
    expect(datasets['Corretiva']).toEqual([2, 0, 0, 0])
    expect(datasets['Preventiva']).toEqual([0, 1, 5, 0])
  });

  it('usa cores claras no gráfico quando o tema está escuro', async () => {
    vi.mocked(maintenanceKpiService.getKpis).mockResolvedValue({ data: { status: 'success', data: mockKpis } } as any)
    vi.mocked(useThemeStore).mockReturnValue({ mode: 'dark', isDark: true, setMode: vi.fn() } as any)

    const router = makeRouter()
    router.push('/maintenance/kpis')
    await router.isReady()

    mount(MaintenanceKpiDashboardView, { global: { plugins: [router] } })
    await flushPromises()
    vi.advanceTimersByTime(100)
    await flushPromises()

    const [chart] = chartInstances
    expect(chart.config.options.scales.x.ticks.color).toBe('#e5e7eb')
    expect(chart.config.options.scales.x.grid.color).toBe('#374151')
  })
})
