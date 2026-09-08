<template>
  <AppLayout title="Dashboard de KPIs de Manutenção" subtitle="MTTR, MTBF, cumprimento do preventivo e ordens em aberto">
    <div v-if="loading" class="text-center py-12">
      <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      <p class="mt-4 text-gray-600 dark:text-gray-400">Carregando dashboard...</p>
    </div>

    <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-lg p-6 text-center dark:bg-red-950 dark:border-red-900">
      <p class="text-red-600 dark:text-red-400">{{ error }}</p>
      <Button @click="loadKpis" class="mt-4">Tentar Novamente</Button>
    </div>

    <div v-else>
      <div class="flex items-center justify-end mb-4 gap-2">
        <select v-model.number="days" class="rounded-md border-gray-300 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
          <option :value="30">30 dias</option>
          <option :value="90">90 dias</option>
          <option :value="180">180 dias</option>
        </select>
        <Button @click="loadKpis">Atualizar</Button>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 dark:bg-gray-800 dark:border-gray-700">
          <p class="text-sm text-gray-600 dark:text-gray-400">MTTR (tempo médio de reparo)</p>
          <p class="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {{ kpis?.mttrHours != null ? `${kpis.mttrHours}h` : '-' }}
          </p>
        </div>
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 dark:bg-gray-800 dark:border-gray-700">
          <p class="text-sm text-gray-600 dark:text-gray-400">Cumprimento do preventivo</p>
          <p class="text-3xl font-bold text-gray-900 dark:text-gray-100">{{ kpis?.preventiveComplianceRate ?? 0 }}%</p>
        </div>
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 dark:bg-gray-800 dark:border-gray-700">
          <p class="text-sm text-gray-600 dark:text-gray-400">Ordens abertas (pendente + em execução)</p>
          <p class="text-3xl font-bold text-gray-900 dark:text-gray-100">{{ openOrdersCount }}</p>
        </div>
      </div>

      <Card title="Ordens por status e tipo" class="mb-4">
        <div class="h-72"><canvas ref="ordersChartRef"></canvas></div>
      </Card>

      <Card title="MTBF por equipamento (horas entre falhas)">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead>
            <tr>
              <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-400">Equipamento</th>
              <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-400">MTBF</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="entry in kpis?.mtbfByEquipment ?? []" :key="entry.equipmentId">
              <td class="px-4 py-2">{{ entry.equipmentCode }} - {{ entry.equipmentName }}</td>
              <td class="px-4 py-2">{{ entry.mtbfHours != null ? `${entry.mtbfHours}h` : 'Dado insuficiente' }}</td>
            </tr>
          </tbody>
        </table>
      </Card>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import AppLayout from '@/components/common/AppLayout.vue'
import Button from '@/components/common/Button.vue'
import Card from '@/components/common/Card.vue'
import maintenanceKpiService from '@/services/maintenance-kpi.service'
import type { MaintenanceKpis } from '@/services/maintenance-kpi.service'
import Chart from 'chart.js/auto'
import { useThemeStore } from '@/stores/theme.store'

const themeStore = useThemeStore()
const chartTextColor = computed(() => (themeStore.isDark ? '#e5e7eb' : '#374151'))
const chartGridColor = computed(() => (themeStore.isDark ? '#374151' : '#e5e7eb'))

const loading = ref(true)
const error = ref('')
const kpis = ref<MaintenanceKpis | null>(null)
const days = ref(90)

const openOrdersCount = computed(() => {
  const rows = kpis.value?.ordersByStatusAndType ?? []
  return rows
    .filter((r) => r.status === 'PENDING' || r.status === 'IN_PROGRESS')
    .reduce((sum, r) => sum + r.count, 0)
})

const ordersChartRef = ref<HTMLCanvasElement | null>(null)
let ordersChart: Chart | null = null

function destroyChart(): void {
  ordersChart?.destroy()
}

function createChart(): void {
  destroyChart()
  if (!ordersChartRef.value || !kpis.value) return

  const rows = kpis.value.ordersByStatusAndType
  const statuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']
  const statusLabels: Record<string, string> = {
    PENDING: 'Pendente',
    IN_PROGRESS: 'Em execução',
    COMPLETED: 'Concluída',
    CANCELLED: 'Cancelada',
  }
  const types = ['PREVENTIVE', 'CORRECTIVE']
  const typeLabels: Record<string, string> = { PREVENTIVE: 'Preventiva', CORRECTIVE: 'Corretiva' }
  const typeColors: Record<string, string> = { PREVENTIVE: '#3B82F6', CORRECTIVE: '#F59E0B' }

  ordersChart = new Chart(ordersChartRef.value, {
    type: 'bar',
    data: {
      labels: statuses.map((s) => statusLabels[s]),
      datasets: types.map((type) => ({
        label: typeLabels[type],
        data: statuses.map((status) => rows.find((r) => r.status === status && r.type === type)?.count ?? 0),
        backgroundColor: typeColors[type],
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { stacked: true, ticks: { color: chartTextColor.value }, grid: { color: chartGridColor.value } },
        y: { stacked: true, beginAtZero: true, ticks: { color: chartTextColor.value }, grid: { color: chartGridColor.value } },
      },
      plugins: { legend: { labels: { color: chartTextColor.value } } },
    },
  })
}

async function loadKpis(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const response = await maintenanceKpiService.getKpis(days.value)
    kpis.value = response.data.data
  } catch (err: any) {
    error.value = err.response?.data?.message || 'Erro ao carregar KPIs de manutenção'
  } finally {
    loading.value = false
    setTimeout(createChart, 100)
  }
}

watch(days, loadKpis)

watch(
  () => themeStore.isDark,
  () => {
    if (!loading.value) createChart()
  }
)

onMounted(loadKpis)
onUnmounted(destroyChart)
</script>
