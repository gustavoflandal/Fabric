<template>
  <AppLayout title="Workflows do WMS" subtitle="Fluxos configuráveis de recebimento">
    <template #actions>
      <RouterLink
        to="/wms/workflows/new"
        class="inline-flex items-center px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-md hover:bg-primary-700"
      >
        Novo Workflow
      </RouterLink>
    </template>

    <DataTable
      :loading="store.loading"
      :items="store.templates"
      empty-title="Nenhum workflow configurado"
      empty-hint="Sem workflows ativos, o recebimento usa a cadeia padrão do sistema."
    >
      <template #head>
        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prioridade</th>
        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
        <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
      </template>
      <template #row="{ item }">
        <td class="px-6 py-4 text-sm text-gray-900">{{ item.name }}</td>
        <td class="px-6 py-4 text-sm text-gray-600">{{ item.priority }}</td>
        <td class="px-6 py-4">
          <StatusBadge :label="item.active ? 'Ativo' : 'Inativo'" :tone="item.active ? 'success' : 'neutral'" />
        </td>
        <td class="px-6 py-4 text-right text-sm space-x-3">
          <RouterLink :to="`/wms/workflows/${item.id}`" class="text-primary-600 hover:underline">
            Editar
          </RouterLink>
          <button type="button" class="text-primary-600 hover:underline" @click="handleDuplicate(item.id)">
            Duplicar
          </button>
          <button type="button" class="text-red-600 hover:underline" @click="askDelete(item)">
            Excluir
          </button>
        </td>
      </template>
    </DataTable>

    <AppModal v-model="deleteModalOpen" title="Excluir workflow" size="sm">
      <p class="text-sm text-gray-700">
        Tem certeza que deseja excluir o workflow "{{ templateToDelete?.name }}"? Recebimentos já criados não são
        afetados — só a criação de novos, que passam a usar outro template (ou a cadeia padrão).
      </p>
      <template #footer>
        <div class="flex justify-end gap-3">
          <button type="button" class="px-4 py-2 text-sm text-gray-700" @click="deleteModalOpen = false">
            Cancelar
          </button>
          <button
            type="button"
            class="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
            @click="confirmDelete"
          >
            Excluir
          </button>
        </div>
      </template>
    </AppModal>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import AppLayout from '@/components/common/AppLayout.vue'
import DataTable from '@/components/common/DataTable.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import AppModal from '@/components/common/AppModal.vue'
import { useWorkflowTemplateStore } from '@/stores/workflow-template.store'
import type { WorkflowTemplate } from '@/types/workflow.types'

const store = useWorkflowTemplateStore()

const deleteModalOpen = ref(false)
const templateToDelete = ref<WorkflowTemplate | null>(null)

onMounted(() => {
  store.fetchTemplates()
})

function askDelete(template: WorkflowTemplate): void {
  templateToDelete.value = template
  deleteModalOpen.value = true
}

async function confirmDelete(): Promise<void> {
  if (!templateToDelete.value) return
  await store.deleteTemplate(templateToDelete.value.id)
  deleteModalOpen.value = false
  templateToDelete.value = null
}

async function handleDuplicate(id: string): Promise<void> {
  await store.duplicateTemplate(id)
}
</script>
