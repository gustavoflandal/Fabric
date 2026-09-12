<template>
  <AppLayout title="Motoristas" subtitle="Gerencie os motoristas cadastrados no pátio">
    <template #actions>
      <Button @click="openCreateModal"><span class="mr-2">+</span>Novo Motorista</Button>
    </template>

    <Card class="mb-6">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormField id="driver-filter-search" label="Buscar" class="md:col-span-2">
          <input
            v-model="filters.search"
            type="text"
            placeholder="Nome ou CPF..."
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
            @input="debouncedFilterChange"
          />
        </FormField>
        <FormField id="driver-filter-supplier" label="Fornecedor">
          <select
            v-model="filters.supplierId"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
            @change="handleFilterChange"
          >
            <option value="">Todos</option>
            <option v-for="sup in supplierStore.suppliers" :key="sup.id" :value="sup.id">{{ sup.name }}</option>
          </select>
        </FormField>
      </div>
    </Card>

    <DataTable
      :loading="loading"
      :error="error"
      :items="driverList"
      :pagination="pagination"
      empty-title="Nenhum motorista encontrado"
      empty-hint="Ajuste os filtros ou cadastre um novo motorista."
      @retry="loadDrivers"
      @change-page="changePage"
    >
      <template #empty-action>
        <Button @click="openCreateModal"><span class="mr-2">+</span>Novo Motorista</Button>
      </template>

      <template #head>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Nome</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">CPF</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Fornecedor</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Status</th>
        <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Ações</th>
      </template>

      <template #row="{ item }">
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{{ asItem(item).name }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{{ asItem(item).cpf }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{{ asItem(item).supplier?.name || '-' }}</td>
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
      :title="editingDriver ? 'Editar Motorista' : 'Novo Motorista'"
      @close="closeModal"
    >
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <FormField id="driver-form-name" label="Nome" required>
          <input v-model="formData.name" type="text" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
        </FormField>
        <FormField id="driver-form-cpf" label="CPF (somente números)" required>
          <input v-model="formData.cpf" type="text" required maxlength="11" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
        </FormField>
        <FormField id="driver-form-supplier" label="Fornecedor" required>
          <select v-model="formData.supplierId" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
            <option value="">Selecione...</option>
            <option v-for="sup in supplierStore.suppliers" :key="sup.id" :value="sup.id">{{ sup.name }}</option>
          </select>
        </FormField>

        <div class="flex gap-3 pt-4">
          <Button type="button" variant="outline" @click="closeModal" class="flex-1">Cancelar</Button>
          <Button type="submit" :disabled="saving" class="flex-1">{{ editingDriver ? 'Salvar' : 'Criar' }}</Button>
        </div>
      </form>
    </AppModal>

    <AppModal v-model="showBlockModal" title="Bloquear Motorista" @close="closeBlockModal">
      <form id="driver-block-form" @submit.prevent="handleConfirmBlock" class="space-y-4">
        <FormField id="driver-block-reason" label="Motivo do bloqueio" required>
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
import { ref, onMounted } from 'vue'
import { useDriverStore } from '@/stores/driver.store'
import { useSupplierStore } from '@/stores/supplier.store'
import type { Driver } from '@/services/driver.service'
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

const driverStore = useDriverStore()
const supplierStore = useSupplierStore()
const toast = useToast()

const driverList = ref<Driver[]>([])
const loading = ref(false)
const error = ref('')
const saving = ref(false)
const showModal = ref(false)
const showBlockModal = ref(false)
const editingDriver = ref<Driver | null>(null)
const blockingDriver = ref<Driver | null>(null)
const blockReasonInput = ref('')
const filters = ref({ search: '', supplierId: '' })
const pagination = ref({ page: 1, limit: 100, total: 0, pages: 0 })
const formData = ref({ name: '', cpf: '', supplierId: '' })

const loadDrivers = async () => {
  try {
    loading.value = true
    error.value = ''
    const result = await driverStore.fetchDrivers(pagination.value.page, pagination.value.limit, {
      supplierId: filters.value.supplierId || undefined,
      search: filters.value.search || undefined,
    })
    driverList.value = result.data
    pagination.value = result.pagination
  } catch (e: any) {
    error.value = e.response?.data?.message || 'Erro ao carregar motoristas'
  } finally {
    loading.value = false
  }
}

const handleFilterChange = () => { pagination.value.page = 1; loadDrivers() }
const debouncedFilterChange = useDebounce(handleFilterChange, 350)
const changePage = (page: number) => { pagination.value.page = page; loadDrivers() }
const resetFormData = () => ({ name: '', cpf: '', supplierId: '' })
const openCreateModal = () => { editingDriver.value = null; formData.value = resetFormData(); showModal.value = true }
const openEditModal = (driver: Driver) => {
  editingDriver.value = driver
  formData.value = { name: driver.name, cpf: driver.cpf, supplierId: driver.supplierId }
  showModal.value = true
}
const closeModal = () => { showModal.value = false; editingDriver.value = null }

const openBlockModal = (driver: Driver) => { blockingDriver.value = driver; blockReasonInput.value = ''; showBlockModal.value = true }
const closeBlockModal = () => { showBlockModal.value = false; blockingDriver.value = null }

const handleSubmit = async () => {
  try {
    saving.value = true
    if (editingDriver.value) {
      await driverStore.updateDriver(editingDriver.value.id, formData.value)
      toast.success('Motorista atualizado com sucesso!')
    } else {
      await driverStore.createDriver(formData.value)
      toast.success('Motorista criado com sucesso!')
    }
    closeModal()
    await loadDrivers()
  } catch (err: any) {
    toast.error(err.response?.data?.message || 'Erro ao salvar motorista')
  } finally {
    saving.value = false
  }
}

const handleConfirmBlock = async () => {
  if (!blockingDriver.value) return
  try {
    await driverStore.setBlocked(blockingDriver.value.id, true, blockReasonInput.value)
    toast.success('Motorista bloqueado com sucesso!')
    closeBlockModal()
    await loadDrivers()
  } catch (err: any) {
    toast.error(err.response?.data?.message || 'Erro ao bloquear motorista')
  }
}

const handleUnblock = async (driver: Driver) => {
  if (await confirmDialog(`Deseja desbloquear o motorista "${driver.name}"?`)) {
    try {
      await driverStore.setBlocked(driver.id, false, null)
      toast.success('Motorista desbloqueado com sucesso!')
      await loadDrivers()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao desbloquear motorista')
    }
  }
}

const handleDelete = async (driver: Driver) => {
  if (await confirmDialog(`Deseja realmente excluir o motorista "${driver.name}"?`)) {
    try {
      await driverStore.deleteDriver(driver.id)
      toast.success('Motorista excluído com sucesso!')
      await loadDrivers()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao excluir motorista')
    }
  }
}

const asItem = (item: unknown) => item as Driver

onMounted(async () => {
  await supplierStore.fetchSuppliers()
  await loadDrivers()
})
</script>
