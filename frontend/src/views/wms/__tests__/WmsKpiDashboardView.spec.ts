import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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

// Chart.js não consegue obter um contexto 2D real em jsdom (seu construtor faz um
// no-op seguro nesse caso). Para testar de verdade a lógica de transformação de
// dados em createCharts() (agrupamento/pivot de byTypeAndStatus, mapeamento de
// cycleTime e occupancy), substituímos o construtor por um mock que apenas
// captura a config recebida.
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

const mockTaskKpis = {
  period: { days: 30 },
  volumeStatus: {
    byTypeAndStatus: [
      { type: 'DESCARGA', status: 'PENDING', count: 3 },
      { type: 'DESCARGA', status: 'COMPLETED', count: 7 },
      { type: 'ALOCACAO', status: 'IN_PROGRESS', count: 2 },
    ],
    receiptsActive: 2,
    receiptsFinished: 5,
  },
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
    chartInstances.length = 0
    // Só falseamos setTimeout/clearTimeout: createCharts() é agendado via
    // setTimeout(createCharts, 100) em loadAll()/watch(days), e precisamos
    // controlar esse timer para que o teste realmente o dispare. setImmediate
    // fica real de propósito, pois flushPromises() do @vue/test-utils depende
    // dele para resolver as promises pendentes dos mocks de serviço.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  })

  afterEach(() => {
    vi.useRealTimers()
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

    // Precisa estar anexado ao document para que getComputedStyle (usado por
    // isVisible()) reflita mudanças de estilo feitas depois da montagem — em nós
    // desconectados o jsdom pode manter um valor computado obsoleto.
    const wrapper = mount(WmsKpiDashboardView, { global: { plugins: [router] }, attachTo: document.body })
    await flushPromises()

    try {
      // Antes de trocar de aba: painel de volume visível, painel de gargalos oculto
      // (v-show, não v-if — ambos já estão no DOM desde o carregamento).
      expect(wrapper.find('[data-testid="tab-panel-volume"]').isVisible()).toBe(true)
      expect(wrapper.find('[data-testid="tab-panel-gargalos"]').isVisible()).toBe(false)

      const bottleneckTab = wrapper.findAll('button').find((b) => b.text().includes('Gargalos'))!
      await bottleneckTab.trigger('click')
      await flushPromises()

      // Depois de clicar: a visibilidade realmente inverteu (prova de que o clique
      // trocou activeTab), e o painel agora visível contém os dados já carregados.
      expect(wrapper.find('[data-testid="tab-panel-volume"]').isVisible()).toBe(false)
      const gargalosPanel = wrapper.find('[data-testid="tab-panel-gargalos"]')
      expect(gargalosPanel.isVisible()).toBe(true)
      expect(gargalosPanel.text()).toContain('REC-2026-0001')
      expect(wmsKpiService.getTaskKpis).toHaveBeenCalledTimes(1)
    } finally {
      wrapper.unmount()
    }
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

  it('createCharts() monta os 3 gráficos com os dados corretos após o timeout de renderização', async () => {
    vi.mocked(wmsKpiService.getTaskKpis).mockResolvedValue(mockTaskKpis as any)
    vi.mocked(wmsKpiService.getOccupancy).mockResolvedValue(mockOccupancy as any)

    const router = makeRouter()
    router.push('/wms/kpis')
    await router.isReady()

    mount(WmsKpiDashboardView, { global: { plugins: [router] } })
    await flushPromises()

    // loadAll() já agendou setTimeout(createCharts, 100); dispara o timer fake.
    vi.advanceTimersByTime(100)
    await flushPromises()

    expect(chartInstances).toHaveLength(3)
    const [volumeChart, cycleChart, occupancyChart] = chartInstances

    // Gráfico Volume/Status: valida o agrupamento/pivot de byTypeAndStatus.
    expect(volumeChart.config.type).toBe('bar')
    expect(volumeChart.config.data.labels).toEqual(['DESCARGA', 'ALOCACAO'])
    const volumeDatasets = Object.fromEntries(
      volumeChart.config.data.datasets.map((d: any) => [d.label, d.data])
    )
    expect(volumeDatasets.PENDING).toEqual([3, 0])
    expect(volumeDatasets.IN_PROGRESS).toEqual([0, 2])
    expect(volumeDatasets.COMPLETED).toEqual([7, 0])
    expect(volumeDatasets.CANCELLED).toEqual([0, 0])

    // Gráfico Tempo de Ciclo: horas médias por etapa.
    expect(cycleChart.config.data.labels).toEqual(['DESCARGA'])
    expect(cycleChart.config.data.datasets[0].data).toEqual([4.5])

    // Gráfico Ocupação: ocupado/livre/bloqueado por armazém.
    expect(occupancyChart.config.data.labels).toEqual(['WH1'])
    const occupancyDatasets = Object.fromEntries(
      occupancyChart.config.data.datasets.map((d: any) => [d.label, d.data])
    )
    expect(occupancyDatasets['Ocupado']).toEqual([10])
    expect(occupancyDatasets['Livre']).toEqual([5])
    expect(occupancyDatasets['Bloqueado']).toEqual([1])
  })

  it('recria os gráficos (destruindo os anteriores) quando o período muda', async () => {
    vi.mocked(wmsKpiService.getTaskKpis).mockResolvedValue(mockTaskKpis as any)
    vi.mocked(wmsKpiService.getOccupancy).mockResolvedValue(mockOccupancy as any)

    const router = makeRouter()
    router.push('/wms/kpis')
    await router.isReady()

    const wrapper = mount(WmsKpiDashboardView, { global: { plugins: [router] } })
    await flushPromises()
    vi.advanceTimersByTime(100)
    await flushPromises()

    expect(chartInstances).toHaveLength(3)
    const [firstVolumeChart, firstCycleChart, firstOccupancyChart] = chartInstances

    const select = wrapper.find('select')
    await select.setValue('90')
    await flushPromises()
    // watch(days, ...) também agenda setTimeout(createCharts, 100).
    vi.advanceTimersByTime(100)
    await flushPromises()

    expect(firstVolumeChart.destroy).toHaveBeenCalledTimes(1)
    expect(firstCycleChart.destroy).toHaveBeenCalledTimes(1)
    expect(firstOccupancyChart.destroy).toHaveBeenCalledTimes(1)
    expect(chartInstances).toHaveLength(6)
  })

  it('mostra o erro só nas 4 abas de tarefas quando falta permissão de tarefas, mantendo a aba de ocupação intacta', async () => {
    vi.mocked(wmsKpiService.getTaskKpis).mockRejectedValue({
      response: { status: 403, data: { message: 'Sem permissão para ver tarefas' } },
    })
    vi.mocked(wmsKpiService.getOccupancy).mockResolvedValue(mockOccupancy as any)

    const router = makeRouter()
    router.push('/wms/kpis')
    await router.isReady()

    const wrapper = mount(WmsKpiDashboardView, { global: { plugins: [router] }, attachTo: document.body })
    await flushPromises()

    try {
      expect(wrapper.find('[data-testid="tab-error-volume"]').text()).toBe('Sem permissão para ver tarefas')

      const occupancyTab = wrapper.findAll('button').find((b) => b.text().includes('Ocupação'))!
      await occupancyTab.trigger('click')
      await flushPromises()

      // A aba de ocupação não usa taskKpisError: continua mostrando os dados
      // reais, não o erro de permissão da outra metade do dashboard.
      expect(wrapper.find('[data-testid="tab-error-ocupacao"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="tab-panel-ocupacao"]').text()).toContain('62.5%')
    } finally {
      wrapper.unmount()
    }
  })

  it('mostra o erro só na aba de ocupação quando falta permissão de ocupação, mantendo as abas de tarefas intactas', async () => {
    vi.mocked(wmsKpiService.getTaskKpis).mockResolvedValue(mockTaskKpis as any)
    vi.mocked(wmsKpiService.getOccupancy).mockRejectedValue({
      response: { status: 403, data: { message: 'Sem permissão para ver ocupação' } },
    })

    const router = makeRouter()
    router.push('/wms/kpis')
    await router.isReady()

    const wrapper = mount(WmsKpiDashboardView, { global: { plugins: [router] }, attachTo: document.body })
    await flushPromises()

    try {
      expect(wrapper.find('[data-testid="tab-error-volume"]').exists()).toBe(false)
      expect(wrapper.text()).toContain('Recebimentos ativos')

      const occupancyTab = wrapper.findAll('button').find((b) => b.text().includes('Ocupação'))!
      await occupancyTab.trigger('click')
      await flushPromises()

      expect(wrapper.find('[data-testid="tab-error-ocupacao"]').text()).toBe('Sem permissão para ver ocupação')
    } finally {
      wrapper.unmount()
    }
  })

  it('não rotula uma falha sem resposta HTTP (rede/timeout) como erro de permissão', async () => {
    vi.mocked(wmsKpiService.getTaskKpis).mockRejectedValue(new Error('Network Error'))
    vi.mocked(wmsKpiService.getOccupancy).mockResolvedValue(mockOccupancy as any)

    const router = makeRouter()
    router.push('/wms/kpis')
    await router.isReady()

    const wrapper = mount(WmsKpiDashboardView, { global: { plugins: [router] } })
    await flushPromises()

    const message = wrapper.find('[data-testid="tab-error-volume"]').text()
    expect(message).not.toContain('permissão')
  })
})
