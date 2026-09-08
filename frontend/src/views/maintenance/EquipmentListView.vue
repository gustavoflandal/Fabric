<template>
  <AppLayout title="Equipamentos" subtitle="Gerencie os equipamentos de manutenção do sistema">
    <template #actions>
      <Button @click="openCreateModal"><span class="mr-2">+</span>Novo Equipamento</Button>
    </template>

    <Card class="mb-6">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <FormField id="eq-filter-search" label="Buscar" class="md:col-span-2">
          <input
            v-model="filters.search"
            type="text"
            placeholder="Código ou nome..."
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            @input="debouncedFilterChange"
          />
        </FormField>
        <FormField id="eq-filter-work-center" label="Centro de Trabalho">
          <select
            v-model="filters.workCenterId"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            @change="handleFilterChange"
          >
            <option value="">Todos</option>
            <option v-for="wc in workCenterStore.workCenters" :key="wc.id" :value="wc.id">{{ wc.name }}</option>
          </select>
        </FormField>
        <FormField id="eq-filter-active" label="Status">
          <select
            v-model="filters.active"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            @change="handleFilterChange"
          >
            <option value="">Todos</option>
            <option value="true">Ativos</option>
            <option value="false">Inativos</option>
          </select>
        </FormField>
      </div>
    </Card>

    <DataTable
      :loading="loading"
      :error="error"
      :items="equipmentList"
      :pagination="pagination"
      empty-title="Nenhum equipamento encontrado"
      empty-hint="Ajuste os filtros ou cadastre um novo equipamento."
      @retry="loadEquipment"
      @change-page="changePage"
    >
      <template #empty-action>
        <Button @click="openCreateModal"><span class="mr-2">+</span>Novo Equipamento</Button>
      </template>

      <template #head>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Código</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Nome</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Centro de Trabalho</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Fabricante/Modelo</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Status</th>
        <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Ações</th>
      </template>

      <template #row="{ item }">
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{{ asItem(item).code }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{{ asItem(item).name }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{{ asItem(item).workCenter?.name || '-' }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{{ formatManufacturer(asItem(item)) }}</td>
        <td class="px-6 py-4 whitespace-nowrap">
          <StatusBadge
            :label="asItem(item).active ? 'Ativo' : 'Inativo'"
            :tone="asItem(item).active ? 'success' : 'danger'"
          />
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
          <button @click="openEditModal(asItem(item))" class="text-primary-600 hover:text-primary-900">Editar</button>
          <button @click="handleToggleActive(asItem(item))" class="text-yellow-600 hover:text-yellow-900">
            {{ asItem(item).active ? 'Desativar' : 'Ativar' }}
          </button>
          <button @click="handleDelete(asItem(item))" class="text-red-600 hover:text-red-900">Excluir</button>
        </td>
      </template>
    </DataTable>

    <AppModal
      v-model="showModal"
      :title="editingEquipment ? 'Editar Equipamento' : 'Novo Equipamento'"
      @close="closeModal"
    >
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <FormField id="eq-form-code" label="Código" required>
            <input v-model="formData.code" type="text" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
          </FormField>
          <FormField id="eq-form-name" label="Nome" required>
            <input v-model="formData.name" type="text" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
          </FormField>
        </div>

        <FormField id="eq-form-work-center" label="Centro de Trabalho" required>
          <select v-model="formData.workCenterId" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500">
            <option value="">Selecione...</option>
            <option v-for="wc in workCenterStore.workCenters" :key="wc.id" :value="wc.id">{{ wc.name }}</option>
          </select>
        </FormField>

        <div class="grid grid-cols-2 gap-4">
          <FormField id="eq-form-manufacturer" label="Fabricante">
            <input v-model="formData.manufacturer" type="text" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
          </FormField>
          <FormField id="eq-form-model" label="Modelo">
            <input v-model="formData.model" type="text" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
          </FormField>
        </div>

        <div class="flex items-center">
          <input v-model="formData.active" type="checkbox" id="eq-form-active" class="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
          <label for="eq-form-active" class="ml-2 text-sm text-gray-700">Ativo</label>
        </div>

        <div class="flex gap-3 pt-4">
          <Button type="button" variant="outline" @click="closeModal" class="flex-1">Cancelar</Button>
          <Button type="submit" :disabled="saving" class="flex-1">{{ editingEquipment ? 'Salvar' : 'Criar' }}</Button>
        </div>
      </form>
    </AppModal>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useEquipmentStore } from '@/stores/equipment.store'
import { useWorkCenterStore } from '@/stores/work-center.store'
import type { Equipment } from '@/services/equipment.service'
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

const equipmentStore = useEquipmentStore()
const workCenterStore = useWorkCenterStore()
const toast = useToast()

const equipmentList = ref<Equipment[]>([])
const loading = ref(false)
const error = ref('')
const saving = ref(false)
const showModal = ref(false)
const editingEquipment = ref<Equipment | null>(null)
const filters = ref({ search: '', workCenterId: '', active: '' })
const pagination = ref({ page: 1, limit: 100, total: 0, pages: 0 })
const formData = ref({
  code: '',
  name: '',
  workCenterId: '',
  manufacturer: '',
  model: '',
  active: true,
})

const loadEquipment = async () => {
  try {
    loading.value = true
    error.value = ''
    const result = await equipmentStore.fetchEquipment(pagination.value.page, pagination.value.limit, {
      workCenterId: filters.value.workCenterId || undefined,
      active: filters.value.active ? filters.value.active === 'true' : undefined,
      search: filters.value.search || undefined,
    })
    equipmentList.value = result.data
    pagination.value = result.pagination
  } catch (e: any) {
    error.value = e.response?.data?.message || 'Erro ao carregar equipamentos'
  } finally {
    loading.value = false
  }
}

const handleFilterChange = () => { pagination.value.page = 1; loadEquipment() }
const debouncedFilterChange = useDebounce(handleFilterChange, 350)
const changePage = (page: number) => { pagination.value.page = page; loadEquipment() }
const resetFormData = () => ({ code: '', name: '', workCenterId: '', manufacturer: '', model: '', active: true })
const openCreateModal = () => { editingEquipment.value = null; formData.value = resetFormData(); showModal.value = true }
const openEditModal = (eq: Equipment) => {
  editingEquipment.value = eq
  formData.value = {
    code: eq.code,
    name: eq.name,
    workCenterId: eq.workCenterId,
    manufacturer: eq.manufacturer || '',
    model: eq.model || '',
    active: eq.active,
  }
  showModal.value = true
}
const closeModal = () => { showModal.value = false; editingEquipment.value = null }

const handleSubmit = async () => {
  try {
    saving.value = true
    const data = {
      ...formData.value,
      manufacturer: formData.value.manufacturer || null,
      model: formData.value.model || null,
    }
    if (editingEquipment.value) {
      await equipmentStore.updateEquipment(editingEquipment.value.id, data)
      toast.success('Equipamento atualizado com sucesso!')
    } else {
      await equipmentStore.createEquipment(data)
      toast.success('Equipamento criado com sucesso!')
    }
    closeModal()
    await loadEquipment()
  } catch (err: any) {
    toast.error(err.response?.data?.message || 'Erro ao salvar equipamento')
  } finally {
    saving.value = false
  }
}

const handleToggleActive = async (eq: Equipment) => {
  if (await confirmDialog(`Deseja ${eq.active ? 'desativar' : 'ativar'} o equipamento "${eq.name}"?`)) {
    const acao = eq.active ? 'desativado' : 'ativado'
    try {
      await equipmentStore.toggleActive(eq.id)
      toast.success(`Equipamento ${acao} com sucesso!`)
      await loadEquipment()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao alterar status')
    }
  }
}

const handleDelete = async (eq: Equipment) => {
  if (await confirmDialog(`Deseja realmente excluir o equipamento "${eq.name}"?`)) {
    try {
      await equipmentStore.deleteEquipment(eq.id)
      toast.success('Equipamento excluído com sucesso!')
      await loadEquipment()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao excluir equipamento')
    }
  }
}

const asItem = (item: unknown) => item as Equipment

const formatManufacturer = (eq: Equipment) => {
  if (eq.manufacturer && eq.model) return `${eq.manufacturer} / ${eq.model}`
  return eq.manufacturer || eq.model || '-'
}

onMounted(async () => {
  await workCenterStore.fetchWorkCenters()
  await loadEquipment()
})
</script>
