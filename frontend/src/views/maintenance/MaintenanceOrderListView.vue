<template>
  <AppLayout title="Ordens de Manutenção" subtitle="Acompanhe e execute as ordens de manutenção preventiva e corretiva">
    <template #actions>
      <Button @click="openCreateModal"><span class="mr-2">+</span>Nova Ordem Corretiva</Button>
    </template>

    <Card class="mb-6">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <FormField id="mo-filter-equipment" label="Equipamento">
          <select
            v-model="filters.equipmentId"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            @change="handleFilterChange"
          >
            <option value="">Todos</option>
            <option v-for="eq in equipmentStore.equipment" :key="eq.id" :value="eq.id">{{ eq.code }} - {{ eq.name }}</option>
          </select>
        </FormField>
        <FormField id="mo-filter-type" label="Tipo">
          <select
            v-model="filters.type"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            @change="handleFilterChange"
          >
            <option value="">Todos</option>
            <option value="PREVENTIVE">Preventiva</option>
            <option value="CORRECTIVE">Corretiva</option>
          </select>
        </FormField>
        <FormField id="mo-filter-status" label="Status">
          <select
            v-model="filters.status"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            @change="handleFilterChange"
          >
            <option value="">Todos</option>
            <option value="PENDING">Pendente</option>
            <option value="IN_PROGRESS">Em execução</option>
            <option value="COMPLETED">Concluída</option>
            <option value="CANCELLED">Cancelada</option>
          </select>
        </FormField>
      </div>
    </Card>

    <DataTable
      :loading="loading"
      :error="error"
      :items="orderList"
      :pagination="pagination"
      empty-title="Nenhuma ordem de manutenção encontrada"
      empty-hint="Ajuste os filtros ou abra uma nova ordem corretiva."
      @retry="loadOrders"
      @change-page="changePage"
    >
      <template #empty-action>
        <Button @click="openCreateModal"><span class="mr-2">+</span>Nova Ordem Corretiva</Button>
      </template>

      <template #head>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Equipamento</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Tipo</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Descrição</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Responsável</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Status</th>
        <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Ações</th>
      </template>

      <template #row="{ item }">
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{{ asItem(item).equipment?.name || '-' }}</td>
        <td class="px-6 py-4 whitespace-nowrap">
          <StatusBadge
            :label="asItem(item).type === 'PREVENTIVE' ? 'Preventiva' : 'Corretiva'"
            :tone="asItem(item).type === 'PREVENTIVE' ? 'info' : 'warning'"
          />
        </td>
        <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">{{ asItem(item).problemDescription || asItem(item).plan?.name || '-' }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{{ asItem(item).assignee?.name || '-' }}</td>
        <td class="px-6 py-4 whitespace-nowrap">
          <StatusBadge :label="statusLabel(asItem(item).status)" :tone="statusTone(asItem(item).status)" />
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
          <button
            v-if="asItem(item).status === 'PENDING'"
            @click="handleStart(asItem(item))"
            class="text-primary-600 hover:text-primary-900"
          >
            Iniciar
          </button>
          <button
            v-if="asItem(item).status === 'IN_PROGRESS'"
            @click="openCompleteModal(asItem(item))"
            class="text-green-600 hover:text-green-900"
          >
            Concluir
          </button>
          <button
            v-if="asItem(item).status === 'PENDING' || asItem(item).status === 'IN_PROGRESS'"
            @click="handleCancel(asItem(item))"
            class="text-red-600 hover:text-red-900"
          >
            Cancelar
          </button>
        </td>
      </template>
    </DataTable>

    <AppModal v-model="showCreateModal" title="Nova Ordem Corretiva" @close="closeCreateModal">
      <form @submit.prevent="handleCreateSubmit" class="space-y-4">
        <FormField id="mo-form-equipment" label="Equipamento" required>
          <select v-model="createFormData.equipmentId" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500">
            <option value="">Selecione...</option>
            <option v-for="eq in equipmentStore.equipment" :key="eq.id" :value="eq.id">{{ eq.code }} - {{ eq.name }}</option>
          </select>
        </FormField>

        <FormField id="mo-form-problem" label="Descrição do problema" required>
          <textarea v-model="createFormData.problemDescription" rows="3" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"></textarea>
        </FormField>

        <FormField id="mo-form-assignee" label="Responsável">
          <select v-model="createFormData.assignedTo" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500">
            <option value="">Sem responsável definido</option>
            <option v-for="user in users" :key="user.id" :value="user.id">{{ user.name }}</option>
          </select>
        </FormField>

        <div class="flex gap-3 pt-4">
          <Button type="button" variant="outline" @click="closeCreateModal" class="flex-1">Cancelar</Button>
          <Button type="submit" :disabled="saving" class="flex-1">Abrir Ordem</Button>
        </div>
      </form>
    </AppModal>

    <AppModal v-model="showCompleteModal" title="Concluir Ordem de Manutenção" @close="closeCompleteModal">
      <form @submit.prevent="handleCompleteSubmit" class="space-y-4">
        <FormField id="mo-form-resolution" label="Solução aplicada" required>
          <textarea v-model="resolutionNotes" rows="3" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"></textarea>
        </FormField>

        <div class="flex gap-3 pt-4">
          <Button type="button" variant="outline" @click="closeCompleteModal" class="flex-1">Cancelar</Button>
          <Button type="submit" :disabled="saving" class="flex-1">Concluir</Button>
        </div>
      </form>
    </AppModal>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useMaintenanceOrderStore } from '@/stores/maintenance-order.store'
import { useEquipmentStore } from '@/stores/equipment.store'
import userService, { type User } from '@/services/user.service'
import type { MaintenanceOrder, MaintenanceOrderStatus } from '@/services/maintenance-order.service'
import AppLayout from '@/components/common/AppLayout.vue'
import AppModal from '@/components/common/AppModal.vue'
import Button from '@/components/common/Button.vue'
import Card from '@/components/common/Card.vue'
import DataTable from '@/components/common/DataTable.vue'
import FormField from '@/components/common/FormField.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import { useToast } from '@/composables/useToast'
import { confirmDialog } from '@/composables/useConfirm'

const orderStore = useMaintenanceOrderStore()
const equipmentStore = useEquipmentStore()
const toast = useToast()

const orderList = ref<MaintenanceOrder[]>([])
const users = ref<User[]>([])
const loading = ref(false)
const error = ref('')
const saving = ref(false)
const showCreateModal = ref(false)
const showCompleteModal = ref(false)
const completingOrder = ref<MaintenanceOrder | null>(null)
const resolutionNotes = ref('')
const filters = ref({ equipmentId: '', type: '', status: '' })
const pagination = ref({ page: 1, limit: 100, total: 0, pages: 0 })
const createFormData = ref({ equipmentId: '', problemDescription: '', assignedTo: '' })

const loadOrders = async () => {
  try {
    loading.value = true
    error.value = ''
    const result = await orderStore.fetchOrders(pagination.value.page, pagination.value.limit, {
      equipmentId: filters.value.equipmentId || undefined,
      type: (filters.value.type || undefined) as any,
      status: (filters.value.status || undefined) as any,
    })
    orderList.value = result.data
    pagination.value = result.pagination
  } catch (e: any) {
    error.value = e.response?.data?.message || 'Erro ao carregar ordens de manutenção'
  } finally {
    loading.value = false
  }
}

const handleFilterChange = () => { pagination.value.page = 1; loadOrders() }
const changePage = (page: number) => { pagination.value.page = page; loadOrders() }

const openCreateModal = () => {
  createFormData.value = { equipmentId: '', problemDescription: '', assignedTo: '' }
  showCreateModal.value = true
}
const closeCreateModal = () => { showCreateModal.value = false }

const handleCreateSubmit = async () => {
  try {
    saving.value = true
    await orderStore.createOrder({
      equipmentId: createFormData.value.equipmentId,
      problemDescription: createFormData.value.problemDescription,
      assignedTo: createFormData.value.assignedTo || null,
    })
    toast.success('Ordem corretiva aberta com sucesso!')
    closeCreateModal()
    await loadOrders()
  } catch (err: any) {
    toast.error(err.response?.data?.message || 'Erro ao abrir ordem corretiva')
  } finally {
    saving.value = false
  }
}

const handleStart = async (order: MaintenanceOrder) => {
  if (await confirmDialog(`Iniciar a ordem de manutenção do equipamento "${order.equipment?.name}"?`)) {
    try {
      await orderStore.startOrder(order.id)
      toast.success('Ordem iniciada!')
      await loadOrders()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao iniciar ordem')
    }
  }
}

const openCompleteModal = (order: MaintenanceOrder) => {
  completingOrder.value = order
  resolutionNotes.value = ''
  showCompleteModal.value = true
}
const closeCompleteModal = () => { showCompleteModal.value = false; completingOrder.value = null }

const handleCompleteSubmit = async () => {
  if (!completingOrder.value) return
  try {
    saving.value = true
    await orderStore.completeOrder(completingOrder.value.id, resolutionNotes.value)
    toast.success('Ordem concluída!')
    closeCompleteModal()
    await loadOrders()
  } catch (err: any) {
    toast.error(err.response?.data?.message || 'Erro ao concluir ordem')
  } finally {
    saving.value = false
  }
}

const handleCancel = async (order: MaintenanceOrder) => {
  if (await confirmDialog(`Cancelar a ordem de manutenção do equipamento "${order.equipment?.name}"?`)) {
    try {
      await orderStore.cancelOrder(order.id)
      toast.success('Ordem cancelada!')
      await loadOrders()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao cancelar ordem')
    }
  }
}

const asItem = (item: unknown) => item as MaintenanceOrder

const statusLabel = (status: MaintenanceOrderStatus) => {
  const labels: Record<MaintenanceOrderStatus, string> = {
    PENDING: 'Pendente',
    IN_PROGRESS: 'Em execução',
    COMPLETED: 'Concluída',
    CANCELLED: 'Cancelada',
  }
  return labels[status]
}

const statusTone = (status: MaintenanceOrderStatus): 'success' | 'warning' | 'danger' | 'info' => {
  const tones: Record<MaintenanceOrderStatus, 'success' | 'warning' | 'danger' | 'info'> = {
    PENDING: 'warning',
    IN_PROGRESS: 'info',
    COMPLETED: 'success',
    CANCELLED: 'danger',
  }
  return tones[status]
}

onMounted(async () => {
  await equipmentStore.fetchEquipment()
  const usersResult = await userService.getAll()
  users.value = usersResult.data
  await loadOrders()
})
</script>
