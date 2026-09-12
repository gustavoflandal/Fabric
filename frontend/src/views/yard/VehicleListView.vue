<template>
  <AppLayout title="Veículos" subtitle="Gerencie os veículos cadastrados no pátio">
    <template #actions>
      <Button @click="openCreateModal"><span class="mr-2">+</span>Novo Veículo</Button>
    </template>

    <Card class="mb-6">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <FormField id="vehicle-filter-search" label="Buscar" class="md:col-span-2">
          <input
            v-model="filters.search"
            type="text"
            placeholder="Placa..."
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
            @input="debouncedFilterChange"
          />
        </FormField>
        <FormField id="vehicle-filter-supplier" label="Fornecedor">
          <select
            v-model="filters.supplierId"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
            @change="handleFilterChange"
          >
            <option value="">Todos</option>
            <option v-for="sup in supplierStore.suppliers" :key="sup.id" :value="sup.id">{{ sup.name }}</option>
          </select>
        </FormField>
        <FormField id="vehicle-filter-type" label="Tipo">
          <select
            v-model="filters.type"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
            @change="handleFilterChange"
          >
            <option value="">Todos</option>
            <option v-for="type in VEHICLE_TYPES" :key="type" :value="type">{{ VEHICLE_TYPE_LABELS[type] }}</option>
          </select>
        </FormField>
      </div>
    </Card>

    <DataTable
      :loading="loading"
      :error="error"
      :items="vehicleList"
      :pagination="pagination"
      empty-title="Nenhum veículo encontrado"
      empty-hint="Ajuste os filtros ou cadastre um novo veículo."
      @retry="loadVehicles"
      @change-page="changePage"
    >
      <template #empty-action>
        <Button @click="openCreateModal"><span class="mr-2">+</span>Novo Veículo</Button>
      </template>

      <template #head>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Placa</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Tipo</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Fornecedor</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Frota</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Status</th>
        <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Ações</th>
      </template>

      <template #row="{ item }">
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{{ asItem(item).plate }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{{ VEHICLE_TYPE_LABELS[asItem(item).type] }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{{ asItem(item).supplier?.name || '-' }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{{ asItem(item).fleet?.name || '-' }}</td>
        <td class="px-6 py-4 whitespace-nowrap">
          <StatusBadge
            :label="asItem(item).blocked ? 'Bloqueado' : 'Ativo'"
            :tone="asItem(item).blocked ? 'danger' : 'success'"
          />
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
          <button @click="openEditModal(asItem(item))" class="text-primary-600 hover:text-primary-900">Editar</button>
          <button v-if="!asItem(item).blocked" @click="openBlockModal(asItem(item))" class="text-yellow-600 hover:text-yellow-900">Bloquear</button>
          <button v-else @click="handleUnblock(asItem(item))" class="text-yellow-600 hover:text-yellow-900">Desbloquear</button>
          <button @click="handleDelete(asItem(item))" class="text-red-600 hover:text-red-900">Excluir</button>
        </td>
      </template>
    </DataTable>

    <AppModal
      v-model="showModal"
      :title="editingVehicle ? 'Editar Veículo' : 'Novo Veículo'"
      @close="closeModal"
    >
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <FormField id="vehicle-form-plate" label="Placa" required>
            <input v-model="formData.plate" type="text" required maxlength="7" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 uppercase dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
          </FormField>
          <FormField id="vehicle-form-type" label="Tipo de Rodado" required>
            <select v-model="formData.type" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
              <option v-for="type in VEHICLE_TYPES" :key="type" :value="type">{{ VEHICLE_TYPE_LABELS[type] }}</option>
            </select>
          </FormField>
        </div>

        <FormField id="vehicle-form-model" label="Modelo (opcional)">
          <input v-model="formData.model" type="text" placeholder="Ex.: Volvo FH" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
        </FormField>

        <FormField id="vehicle-form-supplier" label="Fornecedor" required>
          <select v-model="formData.supplierId" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" @change="formData.fleetId = ''">
            <option value="">Selecione...</option>
            <option v-for="sup in supplierStore.suppliers" :key="sup.id" :value="sup.id">{{ sup.name }}</option>
          </select>
        </FormField>

        <FormField id="vehicle-form-fleet" label="Frota (opcional)">
          <select v-model="formData.fleetId" :disabled="!formData.supplierId" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
            <option value="">Nenhuma</option>
            <option v-for="fleet in fleetsForSelectedSupplier" :key="fleet.id" :value="fleet.id">{{ fleet.name }}</option>
          </select>
        </FormField>

        <div class="flex gap-3 pt-4">
          <Button type="button" variant="outline" @click="closeModal" class="flex-1">Cancelar</Button>
          <Button type="submit" :disabled="saving" class="flex-1">{{ editingVehicle ? 'Salvar' : 'Criar' }}</Button>
        </div>
      </form>
    </AppModal>

    <AppModal v-model="showBlockModal" title="Bloquear Veículo" @close="closeBlockModal">
      <form id="vehicle-block-form" @submit.prevent="handleConfirmBlock" class="space-y-4">
        <FormField id="vehicle-block-reason" label="Motivo do bloqueio" required>
          <textarea v-model="blockReasonInput" rows="3" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"></textarea>
        </FormField>
        <div class="flex gap-3 pt-4">
          <Button type="button" variant="outline" @click="closeBlockModal" class="flex-1">Cancelar</Button>
          <Button type="submit" class="flex-1">Bloquear</Button>
        </div>
      </form>
    </AppModal>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useVehicleStore } from '@/stores/vehicle.store'
import { useSupplierStore } from '@/stores/supplier.store'
import { useFleetStore } from '@/stores/fleet.store'
import type { Vehicle, VehicleType } from '@/services/vehicle.service'
import AppLayout from '@/components/common/AppLayout.vue'
import AppModal from '@/components/common/AppModal.vue'
import Button from '@/components/common/Button.vue'
import Card from '@/components/common/Card.vue'
import DataTable from '@/components/common/DataTable.vue'
import FormField from '@/components/common/FormField.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import { useToast } from '@/composables/useToast'
import { confirmDialog } from '@/composables/useConfirm'
import { useDebounce } from '@/composables/useDebounce'

const VEHICLE_TYPES: VehicleType[] = ['TRUCK', 'TOCO', 'CAVALO', 'MECANICO', 'VAN', 'UTILITARIO', 'OUTROS']
const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  TRUCK: 'Truck',
  TOCO: 'Toco',
  CAVALO: 'Cavalo',
  MECANICO: 'Mecânico',
  VAN: 'Van',
  UTILITARIO: 'Utilitário',
  OUTROS: 'Outros',
}

const vehicleStore = useVehicleStore()
const supplierStore = useSupplierStore()
const fleetStore = useFleetStore()
const toast = useToast()

const vehicleList = ref<Vehicle[]>([])
const loading = ref(false)
const error = ref('')
const saving = ref(false)
const showModal = ref(false)
const showBlockModal = ref(false)
const editingVehicle = ref<Vehicle | null>(null)
const blockingVehicle = ref<Vehicle | null>(null)
const blockReasonInput = ref('')
const filters = ref({ search: '', supplierId: '', type: '' })
const pagination = ref({ page: 1, limit: 100, total: 0, pages: 0 })
const formData = ref({ plate: '', type: 'TRUCK' as VehicleType, model: '', supplierId: '', fleetId: '' })

const fleetsForSelectedSupplier = computed(() =>
  fleetStore.fleets.filter((f) => f.supplierId === formData.value.supplierId)
)

const loadVehicles = async () => {
  try {
    loading.value = true
    error.value = ''
    const result = await vehicleStore.fetchVehicles(pagination.value.page, pagination.value.limit, {
      supplierId: filters.value.supplierId || undefined,
      type: (filters.value.type || undefined) as VehicleType | undefined,
      search: filters.value.search || undefined,
    })
    vehicleList.value = result.data
    pagination.value = result.pagination
  } catch (e: any) {
    error.value = e.response?.data?.message || 'Erro ao carregar veículos'
  } finally {
    loading.value = false
  }
}

const handleFilterChange = () => { pagination.value.page = 1; loadVehicles() }
const debouncedFilterChange = useDebounce(handleFilterChange, 350)
const changePage = (page: number) => { pagination.value.page = page; loadVehicles() }
const resetFormData = () => ({ plate: '', type: 'TRUCK' as VehicleType, model: '', supplierId: '', fleetId: '' })
const openCreateModal = () => { editingVehicle.value = null; formData.value = resetFormData(); showModal.value = true }
const openEditModal = (vehicle: Vehicle) => {
  editingVehicle.value = vehicle
  formData.value = { plate: vehicle.plate, type: vehicle.type, model: vehicle.model || '', supplierId: vehicle.supplierId, fleetId: vehicle.fleetId || '' }
  showModal.value = true
}
const closeModal = () => { showModal.value = false; editingVehicle.value = null }

const openBlockModal = (vehicle: Vehicle) => { blockingVehicle.value = vehicle; blockReasonInput.value = ''; showBlockModal.value = true }
const closeBlockModal = () => { showBlockModal.value = false; blockingVehicle.value = null }

const handleSubmit = async () => {
  try {
    saving.value = true
    const data = { ...formData.value, model: formData.value.model || null, fleetId: formData.value.fleetId || null }
    if (editingVehicle.value) {
      await vehicleStore.updateVehicle(editingVehicle.value.id, data)
      toast.success('Veículo atualizado com sucesso!')
    } else {
      await vehicleStore.createVehicle(data)
      toast.success('Veículo criado com sucesso!')
    }
    closeModal()
    await loadVehicles()
  } catch (err: any) {
    toast.error(err.response?.data?.message || 'Erro ao salvar veículo')
  } finally {
    saving.value = false
  }
}

const handleConfirmBlock = async () => {
  if (!blockingVehicle.value) return
  try {
    await vehicleStore.setBlocked(blockingVehicle.value.id, true, blockReasonInput.value)
    toast.success('Veículo bloqueado com sucesso!')
    closeBlockModal()
    await loadVehicles()
  } catch (err: any) {
    toast.error(err.response?.data?.message || 'Erro ao bloquear veículo')
  }
}

const handleUnblock = async (vehicle: Vehicle) => {
  if (await confirmDialog(`Deseja desbloquear o veículo "${vehicle.plate}"?`)) {
    try {
      await vehicleStore.setBlocked(vehicle.id, false, null)
      toast.success('Veículo desbloqueado com sucesso!')
      await loadVehicles()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao desbloquear veículo')
    }
  }
}

const handleDelete = async (vehicle: Vehicle) => {
  if (await confirmDialog(`Deseja realmente excluir o veículo "${vehicle.plate}"?`)) {
    try {
      await vehicleStore.deleteVehicle(vehicle.id)
      toast.success('Veículo excluído com sucesso!')
      await loadVehicles()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao excluir veículo')
    }
  }
}

const asItem = (item: unknown) => item as Vehicle

onMounted(async () => {
  await supplierStore.fetchSuppliers()
  await fleetStore.fetchFleets()
  await loadVehicles()
})
</script>
