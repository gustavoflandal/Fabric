<template>
  <AppLayout title="Centros de Trabalho" subtitle="Gerencie os centros de trabalho do sistema">
    <template #actions>
      <Button @click="openCreateModal"><span class="mr-2">+</span>Novo Centro de Trabalho</Button>
    </template>

    <Card class="mb-6">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <FormField id="wc-filter-search" label="Buscar" class="md:col-span-2">
          <input
            v-model="filters.search"
            type="text"
            placeholder="Código ou nome..."
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            @input="debouncedFilterChange"
          />
        </FormField>
        <FormField id="wc-filter-type" label="Tipo">
          <select
            v-model="filters.type"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            @change="handleFilterChange"
          >
            <option value="">Todos</option>
            <option value="machine">Máquina</option>
            <option value="manual">Manual</option>
            <option value="assembly">Montagem</option>
            <option value="quality">Qualidade</option>
          </select>
        </FormField>
        <FormField id="wc-filter-active" label="Status">
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
      :items="workCenters"
      :pagination="pagination"
      empty-title="Nenhum centro de trabalho encontrado"
      empty-hint="Ajuste os filtros ou cadastre um novo centro de trabalho."
      @retry="loadWorkCenters"
      @change-page="changePage"
    >
      <template #empty-action>
        <Button @click="openCreateModal"><span class="mr-2">+</span>Novo Centro de Trabalho</Button>
      </template>

      <template #head>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Capacidade</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Eficiência</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Custo/Hora</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
        <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
      </template>

      <template #row="{ item }">
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ asItem(item).code }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{{ asItem(item).name }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ getTypeLabel(asItem(item).type) }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ asItem(item).capacity || '-' }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ (asItem(item).efficiency * 100).toFixed(0) }}%</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ formatCost(asItem(item).costPerHour) }}</td>
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
      :title="editingWorkCenter ? 'Editar Centro de Trabalho' : 'Novo Centro de Trabalho'"
      @close="closeModal"
    >
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <FormField id="wc-form-code" label="Código" required>
            <input v-model="formData.code" type="text" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
          </FormField>
          <FormField id="wc-form-name" label="Nome" required>
            <input v-model="formData.name" type="text" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
          </FormField>
        </div>

        <FormField id="wc-form-description" label="Descrição">
          <textarea v-model="formData.description" rows="2" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"></textarea>
        </FormField>

        <div class="grid grid-cols-2 gap-4">
          <FormField id="wc-form-type" label="Tipo" required>
            <select v-model="formData.type" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500">
              <option value="">Selecione...</option>
              <option value="machine">Máquina</option>
              <option value="manual">Manual</option>
              <option value="assembly">Montagem</option>
              <option value="quality">Qualidade</option>
            </select>
          </FormField>
          <FormField id="wc-form-capacity" label="Capacidade">
            <input v-model.number="formData.capacity" type="number" step="0.01" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
          </FormField>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <FormField id="wc-form-efficiency" label="Eficiência (%)">
            <input v-model.number="formData.efficiency" type="number" step="0.01" min="0" max="100" placeholder="100" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
          </FormField>
          <FormField id="wc-form-cost" label="Custo por Hora (R$)">
            <input v-model.number="formData.costPerHour" type="number" step="0.01" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
          </FormField>
        </div>

        <div class="flex items-center">
          <input v-model="formData.active" type="checkbox" id="wc-form-active" class="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
          <label for="wc-form-active" class="ml-2 text-sm text-gray-700">Ativo</label>
        </div>

        <div class="flex gap-3 pt-4">
          <Button type="button" variant="outline" @click="closeModal" class="flex-1">Cancelar</Button>
          <Button type="submit" :disabled="saving" class="flex-1">{{ editingWorkCenter ? 'Salvar' : 'Criar' }}</Button>
        </div>
      </form>
    </AppModal>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useWorkCenterStore } from '@/stores/work-center.store';
import type { WorkCenter } from '@/services/work-center.service';
import AppLayout from '@/components/common/AppLayout.vue';
import AppModal from '@/components/common/AppModal.vue';
import Button from '@/components/common/Button.vue';
import Card from '@/components/common/Card.vue';
import DataTable from '@/components/common/DataTable.vue';
import FormField from '@/components/common/FormField.vue';
import StatusBadge from '@/components/common/StatusBadge.vue';
import { useToast } from '@/composables/useToast';
import { confirmDialog } from '@/composables/useConfirm';
import { useDebounce } from '@/composables/useDebounce';

const workCenterStore = useWorkCenterStore();
const toast = useToast();

const workCenters = ref<WorkCenter[]>([]);
const loading = ref(false);
// §4.4-5 / I11: erro de carregamento e um estado proprio, nunca "lista vazia".
const error = ref('');
const saving = ref(false);
const showModal = ref(false);
const editingWorkCenter = ref<WorkCenter | null>(null);
const filters = ref({ search: '', type: '', active: '' });
const pagination = ref({ page: 1, limit: 100, total: 0, pages: 0 });
const formData = ref({ code: '', name: '', description: '', type: '', capacity: undefined as number | undefined, efficiency: 1, costPerHour: undefined as number | undefined, active: true });

const loadWorkCenters = async () => {
  try {
    loading.value = true;
    error.value = '';
    const result = await workCenterStore.fetchWorkCenters(pagination.value.page, pagination.value.limit, { type: filters.value.type || undefined, active: filters.value.active ? filters.value.active === 'true' : undefined, search: filters.value.search || undefined });
    workCenters.value = result.data;
    pagination.value = result.pagination;
  } catch (e: any) {
    error.value = e.response?.data?.message || 'Erro ao carregar centros de trabalho';
  } finally {
    loading.value = false;
  }
};

const handleFilterChange = () => { pagination.value.page = 1; loadWorkCenters(); };
const debouncedFilterChange = useDebounce(handleFilterChange, 350);
const changePage = (page: number) => { pagination.value.page = page; loadWorkCenters(); };
const openCreateModal = () => { editingWorkCenter.value = null; formData.value = { code: '', name: '', description: '', type: '', capacity: undefined, efficiency: 1, costPerHour: undefined, active: true }; showModal.value = true; };
const openEditModal = (wc: WorkCenter) => { editingWorkCenter.value = wc; formData.value = { ...wc, efficiency: wc.efficiency || 1 }; showModal.value = true; };
// Esc, focus trap e devolucao de foco agora vem do AppModal (§4.2).
const closeModal = () => { showModal.value = false; editingWorkCenter.value = null; };

const handleSubmit = async () => {
  try {
    saving.value = true;
    const data = { ...formData.value, efficiency: (formData.value.efficiency || 100) / 100 };
    if (editingWorkCenter.value) {
      await workCenterStore.updateWorkCenter(editingWorkCenter.value.id, data);
      toast.success('Centro de trabalho atualizado com sucesso!');
    } else {
      await workCenterStore.createWorkCenter(data);
      toast.success('Centro de trabalho criado com sucesso!');
    }
    closeModal();
    await loadWorkCenters();
  } catch (error: any) {
    toast.error(error.response?.data?.message || 'Erro ao salvar centro de trabalho');
  } finally {
    saving.value = false;
  }
};

const handleToggleActive = async (wc: WorkCenter) => {
  if (await confirmDialog(`Deseja ${wc.active ? 'desativar' : 'ativar'} o centro de trabalho "${wc.name}"?`)) {
    const acao = wc.active ? 'desativado' : 'ativado';
    try {
      await workCenterStore.toggleActive(wc.id);
      toast.success(`Centro de trabalho ${acao} com sucesso!`);
      await loadWorkCenters();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao alterar status');
    }
  }
};

const handleDelete = async (wc: WorkCenter) => {
  if (await confirmDialog(`Deseja realmente excluir o centro de trabalho "${wc.name}"?`)) {
    try {
      await workCenterStore.deleteWorkCenter(wc.id);
      toast.success('Centro de trabalho excluído com sucesso!');
      await loadWorkCenters();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao excluir centro de trabalho');
    }
  }
};

// DataTable expoe o item do slot #row como `unknown` (o componente nao e generico);
// este e o unico ponto de cast da view, mantendo o template tipado.
const asItem = (item: unknown) => item as WorkCenter;

const formatCost = (value?: number) => (value ? `R$ ${value.toFixed(2)}` : '-');

const getTypeLabel = (type: string) => {
  const labels: Record<string, string> = { machine: 'Máquina', manual: 'Manual', assembly: 'Montagem', quality: 'Qualidade' };
  return labels[type] || type;
};

onMounted(() => loadWorkCenters());
</script>
