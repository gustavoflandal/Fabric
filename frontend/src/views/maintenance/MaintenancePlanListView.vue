<template>
  <AppLayout title="Planos de Manutenção" subtitle="Gerencie os planos de manutenção preventiva">
    <template #actions>
      <Button @click="openCreateModal"><span class="mr-2">+</span>Novo Plano</Button>
    </template>

    <Card class="mb-6">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormField id="mp-filter-equipment" label="Equipamento">
          <select
            v-model="filters.equipmentId"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            @change="handleFilterChange"
          >
            <option value="">Todos</option>
            <option v-for="eq in equipmentStore.equipment" :key="eq.id" :value="eq.id">{{ eq.code }} - {{ eq.name }}</option>
          </select>
        </FormField>
        <FormField id="mp-filter-active" label="Status">
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
      :items="planList"
      :pagination="pagination"
      empty-title="Nenhum plano de manutenção encontrado"
      empty-hint="Cadastre um plano para começar a gerar ordens preventivas automaticamente."
      @retry="loadPlans"
      @change-page="changePage"
    >
      <template #empty-action>
        <Button @click="openCreateModal"><span class="mr-2">+</span>Novo Plano</Button>
      </template>

      <template #head>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Equipamento</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Nome</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Frequência</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Próxima execução</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Status</th>
        <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Ações</th>
      </template>

      <template #row="{ item }">
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{{ asItem(item).equipment?.name || '-' }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ asItem(item).name }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">a cada {{ asItem(item).frequencyDays }} dia(s)</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ formatDate(asItem(item).nextDueDate) }}</td>
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
      :title="editingPlan ? 'Editar Plano de Manutenção' : 'Novo Plano de Manutenção'"
      @close="closeModal"
    >
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <FormField id="mp-form-equipment" label="Equipamento" required>
          <select v-model="formData.equipmentId" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500">
            <option value="">Selecione...</option>
            <option v-for="eq in equipmentStore.equipment" :key="eq.id" :value="eq.id">{{ eq.code }} - {{ eq.name }}</option>
          </select>
        </FormField>

        <FormField id="mp-form-name" label="Nome" required>
          <input v-model="formData.name" type="text" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
        </FormField>

        <FormField id="mp-form-description" label="Descrição">
          <textarea v-model="formData.description" rows="2" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"></textarea>
        </FormField>

        <FormField id="mp-form-frequency" label="Frequência (dias)" required>
          <input v-model.number="formData.frequencyDays" type="number" min="1" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
        </FormField>

        <div class="flex items-center">
          <input v-model="formData.active" type="checkbox" id="mp-form-active" class="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
          <label for="mp-form-active" class="ml-2 text-sm text-gray-700">Ativo</label>
        </div>

        <div class="flex gap-3 pt-4">
          <Button type="button" variant="outline" @click="closeModal" class="flex-1">Cancelar</Button>
          <Button type="submit" :disabled="saving" class="flex-1">{{ editingPlan ? 'Salvar' : 'Criar' }}</Button>
        </div>
      </form>
    </AppModal>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useMaintenancePlanStore } from '@/stores/maintenance-plan.store'
import { useEquipmentStore } from '@/stores/equipment.store'
import type { MaintenancePlan } from '@/services/maintenance-plan.service'
import AppLayout from '@/components/common/AppLayout.vue'
import AppModal from '@/components/common/AppModal.vue'
import Button from '@/components/common/Button.vue'
import Card from '@/components/common/Card.vue'
import DataTable from '@/components/common/DataTable.vue'
import FormField from '@/components/common/FormField.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import { useToast } from '@/composables/useToast'
import { confirmDialog } from '@/composables/useConfirm'

const planStore = useMaintenancePlanStore()
const equipmentStore = useEquipmentStore()
const toast = useToast()

const planList = ref<MaintenancePlan[]>([])
const loading = ref(false)
const error = ref('')
const saving = ref(false)
const showModal = ref(false)
const editingPlan = ref<MaintenancePlan | null>(null)
const filters = ref({ equipmentId: '', active: '' })
const pagination = ref({ page: 1, limit: 100, total: 0, pages: 0 })
const formData = ref({ equipmentId: '', name: '', description: '', frequencyDays: 30, active: true })

const loadPlans = async () => {
  try {
    loading.value = true
    error.value = ''
    const result = await planStore.fetchPlans(pagination.value.page, pagination.value.limit, {
      equipmentId: filters.value.equipmentId || undefined,
      active: filters.value.active ? filters.value.active === 'true' : undefined,
    })
    planList.value = result.data
    pagination.value = result.pagination
  } catch (e: any) {
    error.value = e.response?.data?.message || 'Erro ao carregar planos de manutenção'
  } finally {
    loading.value = false
  }
}

const handleFilterChange = () => { pagination.value.page = 1; loadPlans() }
const changePage = (page: number) => { pagination.value.page = page; loadPlans() }
const resetFormData = () => ({ equipmentId: '', name: '', description: '', frequencyDays: 30, active: true })
const openCreateModal = () => { editingPlan.value = null; formData.value = resetFormData(); showModal.value = true }
const openEditModal = (plan: MaintenancePlan) => {
  editingPlan.value = plan
  formData.value = {
    equipmentId: plan.equipmentId,
    name: plan.name,
    description: plan.description || '',
    frequencyDays: plan.frequencyDays,
    active: plan.active,
  }
  showModal.value = true
}
const closeModal = () => { showModal.value = false; editingPlan.value = null }

const handleSubmit = async () => {
  try {
    saving.value = true
    const data = { ...formData.value, description: formData.value.description || null }
    if (editingPlan.value) {
      await planStore.updatePlan(editingPlan.value.id, data)
      toast.success('Plano de manutenção atualizado com sucesso!')
    } else {
      await planStore.createPlan(data)
      toast.success('Plano de manutenção criado com sucesso!')
    }
    closeModal()
    await loadPlans()
  } catch (err: any) {
    toast.error(err.response?.data?.message || 'Erro ao salvar plano de manutenção')
  } finally {
    saving.value = false
  }
}

const handleToggleActive = async (plan: MaintenancePlan) => {
  if (await confirmDialog(`Deseja ${plan.active ? 'desativar' : 'ativar'} o plano "${plan.name}"?`)) {
    const acao = plan.active ? 'desativado' : 'ativado'
    try {
      await planStore.toggleActive(plan.id)
      toast.success(`Plano ${acao} com sucesso!`)
      await loadPlans()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao alterar status')
    }
  }
}

const handleDelete = async (plan: MaintenancePlan) => {
  if (await confirmDialog(`Deseja realmente excluir o plano "${plan.name}"?`)) {
    try {
      await planStore.deletePlan(plan.id)
      toast.success('Plano de manutenção excluído com sucesso!')
      await loadPlans()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao excluir plano de manutenção')
    }
  }
}

const asItem = (item: unknown) => item as MaintenancePlan
const formatDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR')

onMounted(async () => {
  await equipmentStore.fetchEquipment()
  await loadPlans()
})
</script>
