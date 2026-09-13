<template>
  <AppLayout title="Áreas do Pátio" subtitle="Gerencie os setores do pátio e suas vagas">
    <template #actions>
      <Button @click="openCreateModal"><span class="mr-2">+</span>Nova Área</Button>
    </template>

    <Card class="mb-6">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormField id="area-filter-warehouse" label="Armazém">
          <select
            v-model="filters.warehouseId"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
            @change="handleFilterChange"
          >
            <option value="">Todos</option>
            <option v-for="wh in warehouseStore.warehouses" :key="wh.id" :value="wh.id">{{ wh.name }}</option>
          </select>
        </FormField>
      </div>
    </Card>

    <DataTable
      :loading="loading"
      :error="error"
      :items="areaList"
      :pagination="pagination"
      empty-title="Nenhuma área encontrada"
      empty-hint="Ajuste os filtros ou cadastre uma nova área."
      @retry="loadAreas"
      @change-page="changePage"
    >
      <template #empty-action>
        <Button @click="openCreateModal"><span class="mr-2">+</span>Nova Área</Button>
      </template>

      <template #head>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Código</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Nome</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Armazém</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Vagas</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Status</th>
        <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Ações</th>
      </template>

      <template #row="{ item }">
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{{ asItem(item).code }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{{ asItem(item).name }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{{ asItem(item).warehouse?.name || '-' }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{{ asItem(item)._count?.spots ?? 0 }}</td>
        <td class="px-6 py-4 whitespace-nowrap">
          <StatusBadge :label="asItem(item).blocked ? 'Bloqueada' : 'Ativa'" :tone="asItem(item).blocked ? 'danger' : 'success'" />
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
          <RouterLink :to="`/yard/areas/${asItem(item).id}/spots`" class="text-primary-600 hover:text-primary-900">Ver Vagas</RouterLink>
          <button @click="openEditModal(asItem(item))" class="text-primary-600 hover:text-primary-900">Editar</button>
          <button v-if="!asItem(item).blocked" @click="openBlockModal(asItem(item))" class="text-yellow-600 hover:text-yellow-900">Bloquear</button>
          <button v-else @click="handleUnblock(asItem(item))" class="text-yellow-600 hover:text-yellow-900">Desbloquear</button>
          <button @click="handleDelete(asItem(item))" class="text-red-600 hover:text-red-900">Excluir</button>
        </td>
      </template>
    </DataTable>

    <AppModal v-model="showModal" :title="editingArea ? 'Editar Área' : 'Nova Área'" @close="closeModal">
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <FormField id="area-form-warehouse" label="Armazém" required>
          <select v-model="formData.warehouseId" required :disabled="!!editingArea" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
            <option value="">Selecione...</option>
            <option v-for="wh in warehouseStore.warehouses" :key="wh.id" :value="wh.id">{{ wh.name }}</option>
          </select>
        </FormField>
        <div class="grid grid-cols-2 gap-4">
          <FormField id="area-form-code" label="Código" required>
            <input v-model="formData.code" type="text" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
          </FormField>
          <FormField id="area-form-name" label="Nome" required>
            <input v-model="formData.name" type="text" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
          </FormField>
        </div>
        <div class="flex gap-3 pt-4">
          <Button type="button" variant="outline" @click="closeModal" class="flex-1">Cancelar</Button>
          <Button type="submit" :disabled="saving" class="flex-1">{{ editingArea ? 'Salvar' : 'Criar' }}</Button>
        </div>
      </form>
    </AppModal>

    <AppModal v-model="showBlockModal" title="Bloquear Área" @close="closeBlockModal">
      <form id="area-block-form" @submit.prevent="handleConfirmBlock" class="space-y-4">
        <FormField id="area-block-reason" label="Motivo do bloqueio" required>
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
import { useYardAreaStore } from '@/stores/yard-area.store'
import { useWarehouseStore } from '@/stores/warehouse.store'
import type { YardArea } from '@/services/yard-area.service'
import AppLayout from '@/components/common/AppLayout.vue'
import AppModal from '@/components/common/AppModal.vue'
import Button from '@/components/common/Button.vue'
import Card from '@/components/common/Card.vue'
import DataTable from '@/components/common/DataTable.vue'
import FormField from '@/components/common/FormField.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import { useToast } from '@/composables/useToast'
import { confirmDialog } from '@/composables/useConfirm'

const yardAreaStore = useYardAreaStore()
const warehouseStore = useWarehouseStore()
const toast = useToast()

const areaList = ref<YardArea[]>([])
const loading = ref(false)
const error = ref('')
const saving = ref(false)
const showModal = ref(false)
const showBlockModal = ref(false)
const editingArea = ref<YardArea | null>(null)
const blockingArea = ref<YardArea | null>(null)
const blockReasonInput = ref('')
const filters = ref({ warehouseId: '' })
const pagination = ref({ page: 1, limit: 100, total: 0, pages: 0 })
const formData = ref({ warehouseId: '', code: '', name: '' })

const loadAreas = async () => {
  try {
    loading.value = true
    error.value = ''
    const result = await yardAreaStore.fetchAreas(pagination.value.page, pagination.value.limit, {
      warehouseId: filters.value.warehouseId || undefined,
    })
    areaList.value = result.data
    pagination.value = result.pagination
  } catch (e: any) {
    error.value = e.response?.data?.message || 'Erro ao carregar áreas'
  } finally {
    loading.value = false
  }
}

const handleFilterChange = () => { pagination.value.page = 1; loadAreas() }
const changePage = (page: number) => { pagination.value.page = page; loadAreas() }
const resetFormData = () => ({ warehouseId: '', code: '', name: '' })
const openCreateModal = () => { editingArea.value = null; formData.value = resetFormData(); showModal.value = true }
const openEditModal = (area: YardArea) => {
  editingArea.value = area
  formData.value = { warehouseId: area.warehouseId, code: area.code, name: area.name }
  showModal.value = true
}
const closeModal = () => { showModal.value = false; editingArea.value = null }

const openBlockModal = (area: YardArea) => { blockingArea.value = area; blockReasonInput.value = ''; showBlockModal.value = true }
const closeBlockModal = () => { showBlockModal.value = false; blockingArea.value = null }

const handleSubmit = async () => {
  try {
    saving.value = true
    if (editingArea.value) {
      await yardAreaStore.updateArea(editingArea.value.id, { code: formData.value.code, name: formData.value.name })
      toast.success('Área atualizada com sucesso!')
    } else {
      await yardAreaStore.createArea(formData.value)
      toast.success('Área criada com sucesso!')
    }
    closeModal()
    await loadAreas()
  } catch (err: any) {
    toast.error(err.response?.data?.message || 'Erro ao salvar área')
  } finally {
    saving.value = false
  }
}

const handleConfirmBlock = async () => {
  if (!blockingArea.value) return
  try {
    await yardAreaStore.setBlocked(blockingArea.value.id, true, blockReasonInput.value)
    toast.success('Área bloqueada com sucesso!')
    closeBlockModal()
    await loadAreas()
  } catch (err: any) {
    toast.error(err.response?.data?.message || 'Erro ao bloquear área')
  }
}

const handleUnblock = async (area: YardArea) => {
  if (await confirmDialog(`Deseja desbloquear a área "${area.name}"?`)) {
    try {
      await yardAreaStore.setBlocked(area.id, false, null)
      toast.success('Área desbloqueada com sucesso!')
      await loadAreas()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao desbloquear área')
    }
  }
}

const handleDelete = async (area: YardArea) => {
  if (await confirmDialog(`Deseja realmente excluir a área "${area.name}"?`)) {
    try {
      await yardAreaStore.deleteArea(area.id)
      toast.success('Área excluída com sucesso!')
      await loadAreas()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao excluir área')
    }
  }
}

const asItem = (item: unknown) => item as YardArea

onMounted(async () => {
  await warehouseStore.fetchWarehouses()
  await loadAreas()
})
</script>
