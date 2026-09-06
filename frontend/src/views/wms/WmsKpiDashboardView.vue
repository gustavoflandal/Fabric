<template>
  <AppLayout title="Dashboard de KPIs do WMS" subtitle="Volume, tempo de ciclo, produtividade, gargalos e ocupação">
    <div v-if="loading" class="text-center py-12">
      <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      <p class="mt-4 text-gray-600">Carregando dashboard...</p>
    </div>

    <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
      <p class="text-red-600">{{ error }}</p>
      <Button @click="loadAll" class="mt-4">Tentar Novamente</Button>
    </div>

    <div v-else>
      <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
        <nav class="flex gap-2">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            type="button"
            class="px-3 py-1.5 rounded-md text-sm font-medium"
            :class="activeTab === tab.key ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700'"
            @click="activeTab = tab.key"
          >
            {{ tab.label }}
          </button>
        </nav>
        <div class="flex items-center gap-2">
          <select v-if="activeTab !== 'ocupacao'" v-model.number="days" class="rounded-md border-gray-300 text-sm">
            <option :value="7">7 dias</option>
            <option :value="30">30 dias</option>
            <option :value="90">90 dias</option>
          </select>
          <Button @click="loadAll">Atualizar</Button>
        </div>
      </div>

      <div v-show="activeTab === 'volume'" data-testid="tab-panel-volume">
        <div
          v-if="taskKpisError"
          data-testid="tab-error-volume"
          class="bg-red-50 border border-red-200 rounded-lg p-6 text-center"
        >
          <p class="text-red-600">{{ taskKpisError }}</p>
        </div>
        <template v-else>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <p class="text-sm text-gray-600">Recebimentos ativos</p>
              <p class="text-3xl font-bold text-gray-900">{{ taskKpis?.volumeStatus.receiptsActive ?? 0 }}</p>
            </div>
            <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <p class="text-sm text-gray-600">Recebimentos finalizados</p>
              <p class="text-3xl font-bold text-gray-900">{{ taskKpis?.volumeStatus.receiptsFinished ?? 0 }}</p>
            </div>
          </div>
          <Card title="Volume por tipo e status">
            <div class="h-72"><canvas ref="volumeChartRef"></canvas></div>
          </Card>
        </template>
      </div>

      <div v-show="activeTab === 'ciclo'" data-testid="tab-panel-ciclo">
        <div
          v-if="taskKpisError"
          data-testid="tab-error-ciclo"
          class="bg-red-50 border border-red-200 rounded-lg p-6 text-center"
        >
          <p class="text-red-600">{{ taskKpisError }}</p>
        </div>
        <template v-else>
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
            <p class="text-sm text-gray-600">Tempo médio do recebimento completo</p>
            <p class="text-3xl font-bold text-gray-900">{{ taskKpis?.cycleTime.fullReceiptAvgHours ?? 0 }}h</p>
          </div>
          <Card title="Tempo médio por etapa (horas)">
            <div class="h-72"><canvas ref="cycleChartRef"></canvas></div>
          </Card>
        </template>
      </div>

      <div v-show="activeTab === 'produtividade'" data-testid="tab-panel-produtividade">
        <div
          v-if="taskKpisError"
          data-testid="tab-error-produtividade"
          class="bg-red-50 border border-red-200 rounded-lg p-6 text-center"
        >
          <p class="text-red-600">{{ taskKpisError }}</p>
        </div>
        <Card v-else title="Produtividade por operador">
          <table class="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Operador</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tarefas concluídas</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tempo médio de execução</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="entry in taskKpis?.productivity ?? []" :key="entry.userId">
                <td class="px-4 py-2">{{ entry.userName }}</td>
                <td class="px-4 py-2">{{ entry.tasksCompleted }}</td>
                <td class="px-4 py-2">{{ entry.avgExecutionHours }}h</td>
              </tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div v-show="activeTab === 'gargalos'" data-testid="tab-panel-gargalos">
        <div
          v-if="taskKpisError"
          data-testid="tab-error-gargalos"
          class="bg-red-50 border border-red-200 rounded-lg p-6 text-center"
        >
          <p class="text-red-600">{{ taskKpisError }}</p>
        </div>
        <template v-else>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div
              v-for="entry in taskKpis?.bottlenecks.byType ?? []"
              :key="entry.type"
              class="bg-white rounded-lg shadow-sm border border-gray-200 p-4"
            >
              <p class="text-sm text-gray-600">{{ entry.type }}</p>
              <p class="text-3xl font-bold text-red-600">{{ entry.count }}</p>
            </div>
          </div>
          <Card title="Recebimentos afetados">
            <table class="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Recebimento</th>
                  <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Etapa</th>
                  <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Horas parada</th>
                  <th class="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in taskKpis?.bottlenecks.affected ?? []" :key="row.receiptId + row.taskType">
                  <td class="px-4 py-2">{{ row.receiptNumber }}</td>
                  <td class="px-4 py-2">{{ row.taskType }}</td>
                  <td class="px-4 py-2">{{ row.hoursStuck }}h</td>
                  <td class="px-4 py-2">
                    <RouterLink to="/wms/operations" class="text-primary-600 hover:underline">Ver no painel</RouterLink>
                  </td>
                </tr>
              </tbody>
            </table>
          </Card>
        </template>
      </div>

      <div v-show="activeTab === 'ocupacao'" data-testid="tab-panel-ocupacao">
        <div
          v-if="occupancyError"
          data-testid="tab-error-ocupacao"
          class="bg-red-50 border border-red-200 rounded-lg p-6 text-center"
        >
          <p class="text-red-600">{{ occupancyError }}</p>
        </div>
        <template v-else>
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
            <p class="text-sm text-gray-600">% de ocupação geral</p>
            <p class="text-3xl font-bold text-gray-900">{{ overallOccupancyPercent }}%</p>
          </div>
          <Card title="Ocupação por armazém">
            <div class="h-72"><canvas ref="occupancyChartRef"></canvas></div>
          </Card>
        </template>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import AppLayout from '@/components/common/AppLayout.vue'
import Button from '@/components/common/Button.vue'
import Card from '@/components/common/Card.vue'
import wmsKpiService from '@/services/wms-kpi.service'
import type { WmsTaskKpis, OccupancyResponse } from '@/types/wms-kpi.types'
import Chart from 'chart.js/auto'

type TabKey = 'volume' | 'ciclo' | 'produtividade' | 'gargalos' | 'ocupacao'

const tabs: { key: TabKey; label: string }[] = [
  { key: 'volume', label: 'Volume/Status' },
  { key: 'ciclo', label: 'Tempo de Ciclo' },
  { key: 'produtividade', label: 'Produtividade' },
  { key: 'gargalos', label: 'Gargalos' },
  { key: 'ocupacao', label: 'Ocupação' },
]

const activeTab = ref<TabKey>('volume')
const days = ref(30)
const loading = ref(true)
const error = ref('')

const taskKpis = ref<WmsTaskKpis | null>(null)
const occupancy = ref<OccupancyResponse | null>(null)
const taskKpisError = ref('')
const occupancyError = ref('')

const overallOccupancyPercent = computed(() => {
  const rows = occupancy.value?.byWarehouse ?? []
  const total = rows.reduce((sum, r) => sum + r.total, 0)
  const occupied = rows.reduce((sum, r) => sum + r.occupied, 0)
  return total > 0 ? Math.round((occupied / total) * 1000) / 10 : 0
})

const volumeChartRef = ref<HTMLCanvasElement | null>(null)
const cycleChartRef = ref<HTMLCanvasElement | null>(null)
const occupancyChartRef = ref<HTMLCanvasElement | null>(null)

let volumeChart: Chart | null = null
let cycleChart: Chart | null = null
let occupancyChart: Chart | null = null

function permissionErrorMessage(err: any): string {
  return err?.response?.data?.message || 'Sem permissão para ver estes dados'
}

// Usado tanto por loadAll() quanto pelo watch(days, ...): trata erro
// isoladamente (não derruba a outra aba) e descarta a resposta se `days`
// já mudou de novo enquanto a requisição estava em voo (evita que uma
// resposta desatualizada sobrescreva os dados do período atual).
async function loadTaskKpis(): Promise<void> {
  const requestedDays = days.value
  try {
    const data = await wmsKpiService.getTaskKpis(requestedDays)
    if (days.value !== requestedDays) return
    taskKpis.value = data
    taskKpisError.value = ''
  } catch (err: any) {
    if (days.value !== requestedDays) return
    taskKpis.value = null
    taskKpisError.value = permissionErrorMessage(err)
  }
}

async function loadOccupancy(): Promise<void> {
  try {
    occupancy.value = await wmsKpiService.getOccupancy()
    occupancyError.value = ''
  } catch (err: any) {
    occupancy.value = null
    occupancyError.value = permissionErrorMessage(err)
  }
}

async function loadAll(): Promise<void> {
  loading.value = true
  error.value = ''

  // Promise.allSettled (via loadTaskKpis/loadOccupancy, que já capturam seus
  // próprios erros): uma permissão faltando derruba só a metade dela, não o
  // dashboard inteiro — só mostramos o erro de página cheia se AMBAS falharem.
  await Promise.allSettled([loadTaskKpis(), loadOccupancy()])

  if (taskKpisError.value && occupancyError.value) {
    error.value = 'Erro ao carregar dashboard'
  }

  loading.value = false
  setTimeout(createCharts, 100)
}

watch(days, async () => {
  await loadTaskKpis()
  setTimeout(createCharts, 100)
})

function destroyCharts(): void {
  volumeChart?.destroy()
  cycleChart?.destroy()
  occupancyChart?.destroy()
}

function createCharts(): void {
  destroyCharts()

  if (volumeChartRef.value && taskKpis.value) {
    const byType = new Map<string, Record<string, number>>()
    for (const entry of taskKpis.value.volumeStatus.byTypeAndStatus) {
      const row = byType.get(entry.type) ?? {}
      row[entry.status] = entry.count
      byType.set(entry.type, row)
    }
    const labels = [...byType.keys()]
    const statuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']
    const colors: Record<string, string> = {
      PENDING: '#FCD34D',
      IN_PROGRESS: '#3B82F6',
      COMPLETED: '#10B981',
      CANCELLED: '#EF4444',
    }
    volumeChart = new Chart(volumeChartRef.value, {
      type: 'bar',
      data: {
        labels,
        datasets: statuses.map((status) => ({
          label: status,
          data: labels.map((type) => byType.get(type)?.[status] ?? 0),
          backgroundColor: colors[status],
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } },
      },
    })
  }

  if (cycleChartRef.value && taskKpis.value) {
    const labels = taskKpis.value.cycleTime.byType.map((e) => e.type)
    const data = taskKpis.value.cycleTime.byType.map((e) => e.avgHours)
    cycleChart = new Chart(cycleChartRef.value, {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Horas', data, backgroundColor: '#8B5CF6' }] },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true } },
      },
    })
  }

  if (occupancyChartRef.value && occupancy.value) {
    const labels = occupancy.value.byWarehouse.map((w) => w.warehouseCode)
    occupancyChart = new Chart(occupancyChartRef.value, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Ocupado', data: occupancy.value.byWarehouse.map((w) => w.occupied), backgroundColor: '#3B82F6' },
          { label: 'Livre', data: occupancy.value.byWarehouse.map((w) => w.free), backgroundColor: '#10B981' },
          { label: 'Bloqueado', data: occupancy.value.byWarehouse.map((w) => w.blocked), backgroundColor: '#EF4444' },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } },
      },
    })
  }
}

onMounted(loadAll)
onUnmounted(destroyCharts)
</script>
