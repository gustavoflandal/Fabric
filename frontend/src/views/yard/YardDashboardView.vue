<template>
  <AppLayout title="Dashboard do Pátio" subtitle="Totais, ocupação e visitas em tempo real ou por período">
    <Card class="mb-6">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField id="dashboard-warehouse-select" label="Armazém">
          <select
            v-model="selectedWarehouseId"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
            @change="loadDashboard"
          >
            <option v-for="wh in warehouseStore.warehouses" :key="wh.id" :value="wh.id">{{ wh.name }}</option>
          </select>
        </FormField>
        <FormField id="dashboard-days-select" label="Período">
          <select
            v-model="selectedDays"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
            @change="loadDashboard"
          >
            <option value="">Tempo real</option>
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
          </select>
        </FormField>
      </div>
    </Card>

    <div v-if="loading" class="text-center py-12">
      <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      <p class="mt-4 text-gray-600 dark:text-gray-400">Carregando dashboard...</p>
    </div>

    <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-lg p-6 text-center dark:bg-red-950 dark:border-red-900">
      <p class="text-red-700 dark:text-red-300">{{ error }}</p>
    </div>

    <template v-else-if="dashboard">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <p class="text-sm text-gray-500 dark:text-gray-400">Portaria</p>
          <p class="text-3xl font-bold text-gray-900 dark:text-gray-100">{{ dashboard.totals.portaria }}</p>
        </Card>
        <Card>
          <p class="text-sm text-gray-500 dark:text-gray-400">Pátio</p>
          <p class="text-3xl font-bold text-gray-900 dark:text-gray-100">{{ dashboard.totals.patio }}</p>
          <p v-if="dashboard.occupancy.patioRatio" class="text-sm text-gray-500 dark:text-gray-400">
            Ocupação: {{ dashboard.occupancy.patioRatio }} ({{ dashboard.occupancy.patioPercent }}%)
          </p>
          <p v-else class="text-sm text-gray-400">Sem vagas cadastradas</p>
        </Card>
        <Card>
          <p class="text-sm text-gray-500 dark:text-gray-400">Doca</p>
          <p class="text-3xl font-bold text-gray-900 dark:text-gray-100">{{ dashboard.totals.doca }}</p>
          <p v-if="dashboard.occupancy.docaRatio" class="text-sm text-gray-500 dark:text-gray-400">
            Ocupação: {{ dashboard.occupancy.docaRatio }} ({{ dashboard.occupancy.docaPercent }}%)
          </p>
          <p v-else class="text-sm text-gray-400">Sem docas cadastradas</p>
        </Card>
      </div>

      <DataTable :loading="false" :error="''" :items="dashboard.visits" empty-title="Nenhuma visita no período">
        <template #head>
          <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Placa</th>
          <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Motorista</th>
          <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Modelo</th>
          <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Serviço</th>
          <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Fornecedor</th>
          <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Origem</th>
          <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Local</th>
          <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Pontualidade</th>
          <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Responsável</th>
          <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Tempo Total</th>
        </template>

        <template #row="{ item }">
          <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{{ asRow(item).plate || '-' }}</td>
          <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{{ asRow(item).driverName || '-' }}</td>
          <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{{ asRow(item).vehicleModel || '-' }}</td>
          <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{{ SERVICE_TYPE_LABELS[asRow(item).serviceType] }}</td>
          <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{{ asRow(item).supplierName || '-' }}</td>
          <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{{ ORIGIN_LABELS[asRow(item).origin] }}</td>
          <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{{ LOCATION_LABELS[asRow(item).currentLocation] }}</td>
          <td class="px-4 py-3 whitespace-nowrap">
            <StatusBadge
              v-if="asRow(item).punctuality"
              :label="PUNCTUALITY_LABELS[asRow(item).punctuality!]"
              :tone="PUNCTUALITY_TONES[asRow(item).punctuality!]"
            />
            <span v-else class="text-sm text-gray-400">-</span>
          </td>
          <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{{ asRow(item).performedBy || '-' }}</td>
          <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
            {{ asRow(item).totalDurationMinutes !== null ? formatDuration(asRow(item).totalDurationMinutes!) : '-' }}
          </td>
        </template>
      </DataTable>
    </template>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useWarehouseStore } from '@/stores/warehouse.store'
import yardDashboardService, { type YardDashboardResponse, type YardDashboardVisitRow, type PunctualityStatus } from '@/services/yard-dashboard.service'
import AppLayout from '@/components/common/AppLayout.vue'
import Card from '@/components/common/Card.vue'
import DataTable from '@/components/common/DataTable.vue'
import FormField from '@/components/common/FormField.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'

const SERVICE_TYPE_LABELS: Record<YardDashboardVisitRow['serviceType'], string> = {
  RECEBIMENTO: 'Recebimento', EXPEDICAO: 'Expedição', MULTIUSO: 'Multiuso',
}
const ORIGIN_LABELS: Record<YardDashboardVisitRow['origin'], string> = {
  MANUAL: 'Manual', PURCHASE_ORDER: 'Pedido de Compra',
}
const LOCATION_LABELS: Record<YardDashboardVisitRow['currentLocation'], string> = {
  PORTARIA: 'Portaria', PATIO: 'Pátio', DOCA: 'Doca', CONCLUIDA: 'Concluída', CANCELADA: 'Cancelada',
}
const PUNCTUALITY_LABELS: Record<Exclude<PunctualityStatus, null>, string> = {
  NO_HORARIO: 'No horário', ANTECIPADO: 'Antecipado', ATRASADO: 'Atrasado',
}
const PUNCTUALITY_TONES: Record<Exclude<PunctualityStatus, null>, 'success' | 'warning' | 'danger'> = {
  NO_HORARIO: 'success', ANTECIPADO: 'warning', ATRASADO: 'danger',
}

const warehouseStore = useWarehouseStore()

const selectedWarehouseId = ref('')
const selectedDays = ref('')
const loading = ref(false)
const error = ref('')
const dashboard = ref<YardDashboardResponse | null>(null)

const loadDashboard = async () => {
  if (!selectedWarehouseId.value) return
  try {
    loading.value = true
    error.value = ''
    const days = selectedDays.value ? Number(selectedDays.value) : undefined
    const result = await yardDashboardService.getDashboard(selectedWarehouseId.value, days)
    dashboard.value = result.data.data
  } catch (err: any) {
    error.value = err.response?.data?.message || 'Erro ao carregar dashboard'
  } finally {
    loading.value = false
  }
}

const asRow = (item: unknown) => item as YardDashboardVisitRow

const formatDuration = (minutes: number) => {
  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60
  return hours > 0 ? `${hours}h${remaining.toString().padStart(2, '0')}min` : `${remaining}min`
}

onMounted(async () => {
  await warehouseStore.fetchWarehouses()
  if (warehouseStore.warehouses.length > 0) {
    selectedWarehouseId.value = warehouseStore.warehouses[0].id
    await loadDashboard()
  }
})
</script>
