<template>
  <AppLayout title="Docas" subtitle="Gerencie as docas de carga e descarga do pátio">
    <template #actions>
      <Button @click="openCreateModal"><span class="mr-2">+</span>Nova Doca</Button>
    </template>

    <Card class="mb-6">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormField id="dock-filter-warehouse" label="Armazém">
          <select
            v-model="filters.warehouseId"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
            @change="handleFilterChange"
          >
            <option value="">Todos</option>
            <option v-for="wh in warehouseStore.warehouses" :key="wh.id" :value="wh.id">{{ wh.name }}</option>
          </select>
        </FormField>
        <FormField id="dock-filter-service-type" label="Tipo de Serviço">
          <select
            v-model="filters.serviceType"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
            @change="handleFilterChange"
          >
            <option value="">Todos</option>
            <option value="RECEBIMENTO">Recebimento</option>
            <option value="EXPEDICAO">Expedição</option>
            <option value="MULTIUSO">Multiuso</option>
          </select>
        </FormField>
        <FormField id="dock-filter-active" label="Status">
          <select
            v-model="filters.active"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
            @change="handleFilterChange"
          >
            <option value="">Todos</option>
            <option value="true">Ativas</option>
            <option value="false">Inativas</option>
          </select>
        </FormField>
      </div>
    </Card>

    <DataTable
      :loading="loading"
      :error="error"
      :items="dockList"
      :pagination="pagination"
      empty-title="Nenhuma doca encontrada"
      empty-hint="Ajuste os filtros ou cadastre uma nova doca."
      @retry="loadDocks"
      @change-page="changePage"
    >
      <template #empty-action>
        <Button @click="openCreateModal"><span class="mr-2">+</span>Nova Doca</Button>
      </template>

      <template #head>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Código</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Armazém</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Tipo de Serviço</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Posição Vinculada</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Status</th>
        <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Ações</th>
      </template>

      <template #row="{ item }">
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{{ asItem(item).code }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{{ asItem(item).warehouse?.name || '-' }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{{ SERVICE_TYPE_LABELS[asItem(item).serviceType] }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{{ asItem(item).storagePosition?.code || '-' }}</td>
        <td class="px-6 py-4 whitespace-nowrap">
          <StatusBadge
            :label="asItem(item).active ? 'Ativa' : 'Inativa'"
            :tone="asItem(item).active ? 'success' : 'danger'"
          />
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
          <button @click="openEditModal(asItem(item))" class="text-primary-600 hover:text-primary-900">Editar</button>
          <button @click="handleDelete(asItem(item))" class="text-red-600 hover:text-red-900">Excluir</button>
        </td>
      </template>
    </DataTable>

    <AppModal
      v-model="showModal"
      :title="editingDock ? 'Editar Doca' : 'Nova Doca'"
      @close="closeModal"
    >
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <FormField id="dock-form-code" label="Código" required>
            <input v-model="formData.code" type="text" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
          </FormField>
          <FormField id="dock-form-service-type" label="Tipo de Serviço" required>
            <select v-model="formData.serviceType" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
              <option value="RECEBIMENTO">Recebimento</option>
              <option value="EXPEDICAO">Expedição</option>
              <option value="MULTIUSO">Multiuso</option>
            </select>
          </FormField>
        </div>

        <FormField id="dock-form-warehouse" label="Armazém" required>
          <select v-model="formData.warehouseId" required :disabled="!!editingDock" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
            <option value="">Selecione...</option>
            <option v-for="wh in warehouseStore.warehouses" :key="wh.id" :value="wh.id">{{ wh.name }}</option>
          </select>
        </FormField>

        <FormField id="dock-form-position-code" label="Código da posição de armazenagem vinculada (opcional)">
          <div class="flex gap-2">
            <input
              v-model="positionCodeInput"
              type="text"
              placeholder="Ex.: WH1-R01-01-01"
              class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
            />
            <Button type="button" variant="outline" @click="handleLookupPosition">Buscar</Button>
          </div>
          <p v-if="positionLookupMessage" class="mt-1 text-sm" :class="positionLookupError ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'">
            {{ positionLookupMessage }}
          </p>
        </FormField>

        <div class="flex items-center">
          <input v-model="formData.active" type="checkbox" id="dock-form-active" class="rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:border-gray-600" />
          <label for="dock-form-active" class="ml-2 text-sm text-gray-700 dark:text-gray-300">Ativa</label>
        </div>

        <div class="flex gap-3 pt-4">
          <Button type="button" variant="outline" @click="closeModal" class="flex-1">Cancelar</Button>
          <Button type="submit" :disabled="saving" class="flex-1">{{ editingDock ? 'Salvar' : 'Criar' }}</Button>
        </div>
      </form>
    </AppModal>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useYardDockStore } from '@/stores/yard-dock.store'
import { useWarehouseStore } from '@/stores/warehouse.store'
import { storagePositionService } from '@/services/storage-position.service'
import type { YardDock, DockServiceType } from '@/services/yard-dock.service'
import AppLayout from '@/components/common/AppLayout.vue'
import AppModal from '@/components/common/AppModal.vue'
import Button from '@/components/common/Button.vue'
import Card from '@/components/common/Card.vue'
import DataTable from '@/components/common/DataTable.vue'
import FormField from '@/components/common/FormField.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import { useToast } from '@/composables/useToast'
import { confirmDialog } from '@/composables/useConfirm'

const SERVICE_TYPE_LABELS: Record<DockServiceType, string> = {
  RECEBIMENTO: 'Recebimento',
  EXPEDICAO: 'Expedição',
  MULTIUSO: 'Multiuso',
}

const yardDockStore = useYardDockStore()
const warehouseStore = useWarehouseStore()
const toast = useToast()

const dockList = ref<YardDock[]>([])
const loading = ref(false)
const error = ref('')
const saving = ref(false)
const showModal = ref(false)
const editingDock = ref<YardDock | null>(null)
const filters = ref({ warehouseId: '', serviceType: '', active: '' })
const pagination = ref({ page: 1, limit: 100, total: 0, pages: 0 })
const formData = ref({
  code: '',
  serviceType: 'RECEBIMENTO' as DockServiceType,
  warehouseId: '',
  storagePositionId: null as string | null,
  active: true,
})
const positionCodeInput = ref('')
const positionLookupMessage = ref('')
const positionLookupError = ref(false)

const loadDocks = async () => {
  try {
    loading.value = true
    error.value = ''
    const result = await yardDockStore.fetchDocks(pagination.value.page, pagination.value.limit, {
      warehouseId: filters.value.warehouseId || undefined,
      serviceType: (filters.value.serviceType || undefined) as DockServiceType | undefined,
      active: filters.value.active ? filters.value.active === 'true' : undefined,
    })
    dockList.value = result.data
    pagination.value = result.pagination
  } catch (e: any) {
    error.value = e.response?.data?.message || 'Erro ao carregar docas'
  } finally {
    loading.value = false
  }
}

const handleFilterChange = () => { pagination.value.page = 1; loadDocks() }
const changePage = (page: number) => { pagination.value.page = page; loadDocks() }
const resetFormData = () => ({
  code: '',
  serviceType: 'RECEBIMENTO' as DockServiceType,
  warehouseId: '',
  storagePositionId: null as string | null,
  active: true,
})
const openCreateModal = () => {
  editingDock.value = null
  formData.value = resetFormData()
  positionCodeInput.value = ''
  positionLookupMessage.value = ''
  showModal.value = true
}
const openEditModal = (dock: YardDock) => {
  editingDock.value = dock
  formData.value = {
    code: dock.code,
    serviceType: dock.serviceType,
    warehouseId: dock.warehouseId,
    storagePositionId: dock.storagePositionId,
    active: dock.active,
  }
  positionCodeInput.value = dock.storagePosition?.code || ''
  positionLookupMessage.value = ''
  showModal.value = true
}
const closeModal = () => { showModal.value = false; editingDock.value = null }

const handleLookupPosition = async () => {
  if (!positionCodeInput.value.trim()) {
    formData.value.storagePositionId = null
    positionLookupMessage.value = ''
    return
  }
  try {
    const result = await storagePositionService.getPositionByCode(positionCodeInput.value.trim())
    formData.value.storagePositionId = result.data.id
    positionLookupMessage.value = `Posição encontrada: ${result.data.code}`
    positionLookupError.value = false
  } catch (err: any) {
    formData.value.storagePositionId = null
    positionLookupMessage.value = err.response?.data?.message || 'Posição não encontrada'
    positionLookupError.value = true
  }
}

const handleSubmit = async () => {
  try {
    saving.value = true
    if (editingDock.value) {
      const { warehouseId, ...updateData } = formData.value
      await yardDockStore.updateDock(editingDock.value.id, updateData)
      toast.success('Doca atualizada com sucesso!')
    } else {
      await yardDockStore.createDock(formData.value)
      toast.success('Doca criada com sucesso!')
    }
    closeModal()
    await loadDocks()
  } catch (err: any) {
    toast.error(err.response?.data?.message || 'Erro ao salvar doca')
  } finally {
    saving.value = false
  }
}

const handleDelete = async (dock: YardDock) => {
  if (await confirmDialog(`Deseja realmente excluir a doca "${dock.code}"?`)) {
    try {
      await yardDockStore.deleteDock(dock.id)
      toast.success('Doca excluída com sucesso!')
      await loadDocks()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao excluir doca')
    }
  }
}

const asItem = (item: unknown) => item as YardDock

onMounted(async () => {
  await warehouseStore.fetchWarehouses()
  await loadDocks()
})
</script>
