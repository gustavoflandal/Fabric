<template>
  <AppLayout title="Frotas" subtitle="Gerencie as frotas de veículos por fornecedor">
    <template #actions>
      <Button @click="openCreateModal"><span class="mr-2">+</span>Nova Frota</Button>
    </template>

    <Card class="mb-6">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormField id="fleet-filter-supplier" label="Fornecedor">
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
      :items="fleetList"
      :pagination="pagination"
      empty-title="Nenhuma frota encontrada"
      empty-hint="Ajuste os filtros ou cadastre uma nova frota."
      @retry="loadFleets"
      @change-page="changePage"
    >
      <template #empty-action>
        <Button @click="openCreateModal"><span class="mr-2">+</span>Nova Frota</Button>
      </template>

      <template #head>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Nome</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Fornecedor</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Veículos</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Status</th>
        <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Ações</th>
      </template>

      <template #row="{ item }">
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{{ asItem(item).name }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{{ asItem(item).supplier?.name || '-' }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{{ asItem(item)._count?.vehicles ?? 0 }}</td>
        <td class="px-6 py-4 whitespace-nowrap">
          <StatusBadge
            :label="asItem(item).blocked ? 'Bloqueada' : 'Ativa'"
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
      :title="editingFleet ? 'Editar Frota' : 'Nova Frota'"
      @close="closeModal"
    >
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <FormField id="fleet-form-name" label="Nome" required>
          <input v-model="formData.name" type="text" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
        </FormField>
        <FormField id="fleet-form-supplier" label="Fornecedor" required>
          <select v-model="formData.supplierId" required :disabled="!!editingFleet" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
            <option value="">Selecione...</option>
            <option v-for="sup in supplierStore.suppliers" :key="sup.id" :value="sup.id">{{ sup.name }}</option>
          </select>
        </FormField>

        <div class="flex gap-3 pt-4">
          <Button type="button" variant="outline" @click="closeModal" class="flex-1">Cancelar</Button>
          <Button type="submit" :disabled="saving" class="flex-1">{{ editingFleet ? 'Salvar' : 'Criar' }}</Button>
        </div>
      </form>
    </AppModal>

    <AppModal v-model="showBlockModal" title="Bloquear Frota" @close="closeBlockModal">
      <form id="fleet-block-form" @submit.prevent="handleConfirmBlock" class="space-y-4">
        <p v-if="blockingFleet" class="text-sm text-gray-600 dark:text-gray-400">
          Bloquear esta frota também bloqueia {{ blockingFleet._count?.vehicles ?? 0 }} veículo(s) vinculado(s) a ela.
        </p>
        <FormField id="fleet-block-reason" label="Motivo do bloqueio" required>
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
import { useFleetStore } from '@/stores/fleet.store'
import { useSupplierStore } from '@/stores/supplier.store'
import type { Fleet } from '@/services/fleet.service'
import AppLayout from '@/components/common/AppLayout.vue'
import AppModal from '@/components/common/AppModal.vue'
import Button from '@/components/common/Button.vue'
import Card from '@/components/common/Card.vue'
import DataTable from '@/components/common/DataTable.vue'
import FormField from '@/components/common/FormField.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import { useToast } from '@/composables/useToast'
import { confirmDialog } from '@/composables/useConfirm'

const fleetStore = useFleetStore()
const supplierStore = useSupplierStore()
const toast = useToast()

const fleetList = ref<Fleet[]>([])
const loading = ref(false)
const error = ref('')
const saving = ref(false)
const showModal = ref(false)
const showBlockModal = ref(false)
const editingFleet = ref<Fleet | null>(null)
const blockingFleet = ref<Fleet | null>(null)
const blockReasonInput = ref('')
const filters = ref({ supplierId: '' })
const pagination = ref({ page: 1, limit: 100, total: 0, pages: 0 })
const formData = ref({ name: '', supplierId: '' })

const loadFleets = async () => {
  try {
    loading.value = true
    error.value = ''
    const result = await fleetStore.fetchFleets(pagination.value.page, pagination.value.limit, {
      supplierId: filters.value.supplierId || undefined,
    })
    fleetList.value = result.data
    pagination.value = result.pagination
  } catch (e: any) {
    error.value = e.response?.data?.message || 'Erro ao carregar frotas'
  } finally {
    loading.value = false
  }
}

const handleFilterChange = () => { pagination.value.page = 1; loadFleets() }
const changePage = (page: number) => { pagination.value.page = page; loadFleets() }
const resetFormData = () => ({ name: '', supplierId: '' })
const openCreateModal = () => { editingFleet.value = null; formData.value = resetFormData(); showModal.value = true }
const openEditModal = (fleet: Fleet) => {
  editingFleet.value = fleet
  formData.value = { name: fleet.name, supplierId: fleet.supplierId }
  showModal.value = true
}
const closeModal = () => { showModal.value = false; editingFleet.value = null }

const openBlockModal = (fleet: Fleet) => { blockingFleet.value = fleet; blockReasonInput.value = ''; showBlockModal.value = true }
const closeBlockModal = () => { showBlockModal.value = false; blockingFleet.value = null }

const handleSubmit = async () => {
  try {
    saving.value = true
    if (editingFleet.value) {
      await fleetStore.updateFleet(editingFleet.value.id, { name: formData.value.name })
      toast.success('Frota atualizada com sucesso!')
    } else {
      await fleetStore.createFleet(formData.value)
      toast.success('Frota criada com sucesso!')
    }
    closeModal()
    await loadFleets()
  } catch (err: any) {
    toast.error(err.response?.data?.message || 'Erro ao salvar frota')
  } finally {
    saving.value = false
  }
}

const handleConfirmBlock = async () => {
  if (!blockingFleet.value) return
  try {
    await fleetStore.setBlocked(blockingFleet.value.id, true, blockReasonInput.value)
    toast.success('Frota bloqueada com sucesso!')
    closeBlockModal()
    await loadFleets()
  } catch (err: any) {
    toast.error(err.response?.data?.message || 'Erro ao bloquear frota')
  }
}

const handleUnblock = async (fleet: Fleet) => {
  if (await confirmDialog(`Deseja desbloquear a frota "${fleet.name}"?`)) {
    try {
      await fleetStore.setBlocked(fleet.id, false, null)
      toast.success('Frota desbloqueada com sucesso!')
      await loadFleets()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao desbloquear frota')
    }
  }
}

const handleDelete = async (fleet: Fleet) => {
  if (await confirmDialog(`Deseja realmente excluir a frota "${fleet.name}"?`)) {
    try {
      await fleetStore.deleteFleet(fleet.id)
      toast.success('Frota excluída com sucesso!')
      await loadFleets()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao excluir frota')
    }
  }
}

const asItem = (item: unknown) => item as Fleet

onMounted(async () => {
  await supplierStore.fetchSuppliers()
  await loadFleets()
})
</script>
