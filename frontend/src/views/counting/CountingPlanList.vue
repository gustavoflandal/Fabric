<template>
  <AppLayout title="Planos de Inventário" subtitle="Gerencie os planos de inventário de estoque">
    <template #actions>
      <RouterLink
        to="/counting/plans/new"
        class="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md shadow-sm"
      >
        <PlusIcon class="w-5 h-5 mr-2" />
        Novo Plano
      </RouterLink>
    </template>

    <!-- Filters -->
    <Card class="mb-6">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <FormField id="counting-plans-filter-status" label="Status">
          <select v-model="filters.status" class="w-full border-gray-300 rounded-md shadow-sm">
            <option value="">Todos</option>
            <option value="DRAFT">Rascunho</option>
            <option value="ACTIVE">Ativo</option>
            <option value="PAUSED">Pausado</option>
            <option value="COMPLETED">Concluído</option>
            <option value="CANCELLED">Cancelado</option>
          </select>
        </FormField>
        <FormField id="counting-plans-filter-type" label="Tipo">
          <select v-model="filters.type" class="w-full border-gray-300 rounded-md shadow-sm">
            <option value="">Todos</option>
            <option value="FULL">Completa</option>
            <option value="PARTIAL">Parcial</option>
            <option value="CYCLIC">Cíclica</option>
          </select>
        </FormField>
        <FormField id="counting-plans-filter-frequency" label="Frequência">
          <select v-model="filters.frequency" class="w-full border-gray-300 rounded-md shadow-sm">
            <option value="">Todas</option>
            <option value="DAILY">Diária</option>
            <option value="WEEKLY">Semanal</option>
            <option value="MONTHLY">Mensal</option>
            <option value="QUARTERLY">Trimestral</option>
            <option value="YEARLY">Anual</option>
          </select>
        </FormField>
        <FormField id="counting-plans-filter-search" label="Buscar">
          <input
            v-model="filters.search"
            type="text"
            placeholder="Nome ou código..."
            class="w-full border-gray-300 rounded-md shadow-sm"
          />
        </FormField>
      </div>
    </Card>

    <!-- Plans Table — aqui o `loading` do store e exclusivo deste fetch. -->
    <DataTable
      :loading="loading"
      :error="error"
      :items="plans"
      empty-title="Nenhum plano encontrado"
      empty-hint="Comece criando um novo plano de inventário."
      @retry="loadPlans"
    >
      <template #head>
        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
          Código
        </th>
        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          Nome
        </th>
        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
          Tipo
        </th>
        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
          Frequência
        </th>
        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
          Status
        </th>
        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-56">
          Ações
        </th>
      </template>

      <template #row="{ item: plan }">
        <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
          {{ plan.code }}
        </td>
        <td class="px-4 py-3 text-sm text-gray-900">
          {{ plan.name }}
        </td>
        <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
          {{ formatType(plan.type) }}
        </td>
        <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
          {{ formatFrequency(plan.frequency) }}
        </td>
        <td class="px-4 py-3 whitespace-nowrap">
          <StatusBadge :label="formatStatus(plan.status)" :tone="getStatusTone(plan.status)" />
        </td>
        <td class="px-4 py-3 whitespace-nowrap text-sm">
          <div class="flex items-center space-x-3">
            <RouterLink
              :to="`/counting/plans/${plan.id}`"
              class="text-blue-600 hover:text-blue-900 font-medium"
            >
              Editar
            </RouterLink>
            <button
              v-if="plan.status === 'DRAFT'"
              @click="activatePlan(plan.id)"
              class="text-green-600 hover:text-green-900 font-medium"
            >
              Ativar
            </button>
            <button
              v-if="plan.status === 'ACTIVE'"
              @click="pausePlan(plan.id)"
              class="text-yellow-600 hover:text-yellow-900 font-medium"
            >
              Pausar
            </button>
            <button
              v-if="plan.status === 'PAUSED'"
              @click="activatePlan(plan.id)"
              class="text-green-600 hover:text-green-900 font-medium"
            >
              Retomar
            </button>
            <button
              @click="deletePlan(plan.id)"
              class="text-red-600 hover:text-red-900 font-medium"
            >
              Excluir
            </button>
          </div>
        </td>
      </template>
    </DataTable>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { useCountingStore } from '@/stores/counting.store';
import { storeToRefs } from 'pinia';
import type { PlanFilters } from '@/types/counting.types';
import AppLayout from '@/components/common/AppLayout.vue';
import Card from '@/components/common/Card.vue';
import DataTable from '@/components/common/DataTable.vue';
import FormField from '@/components/common/FormField.vue';
import StatusBadge, { type BadgeTone } from '@/components/common/StatusBadge.vue';
import { PlusIcon } from '@heroicons/vue/24/outline';
import { useToast } from '@/composables/useToast';
import { confirmDialog } from '@/composables/useConfirm';

const countingStore = useCountingStore();
const toast = useToast();
const { plans, loading } = storeToRefs(countingStore);

// Antes nao havia estado de erro algum: uma falha no fetch deixava a tela
// parecendo "nenhum plano encontrado" (I11).
const error = ref('');

const filters = ref<PlanFilters>({
  status: '',
  type: '',
  frequency: '',
  search: '',
});

onMounted(async () => {
  await loadPlans();
});

watch(filters, async () => {
  await loadPlans();
}, { deep: true });

const loadPlans = async () => {
  error.value = '';
  try {
    await countingStore.fetchPlans(filters.value);
  } catch (err: any) {
    error.value = err.response?.data?.message || err.message || 'Erro ao carregar planos';
  }
};

const activatePlan = async (id: string) => {
  try {
    await countingStore.activatePlan(id);
    await loadPlans();
  } catch (err: any) {
    toast.error(err.response?.data?.message || 'Erro ao ativar plano');
  }
};

const pausePlan = async (id: string) => {
  try {
    await countingStore.pausePlan(id);
    await loadPlans();
  } catch (err: any) {
    toast.error(err.response?.data?.message || 'Erro ao pausar plano');
  }
};

const deletePlan = async (id: string) => {
  if (!(await confirmDialog('Tem certeza que deseja excluir este plano de inventário?'))) {
    return;
  }

  try {
    await countingStore.deletePlan(id);
    await loadPlans();
  } catch (err) {
    console.error('Erro ao excluir plano:', err);
    toast.error('Erro ao excluir plano. Verifique se não há sessões vinculadas.');
  }
};

const formatType = (type: string) => {
  const types: Record<string, string> = {
    FULL: 'Completa',
    PARTIAL: 'Parcial',
    CYCLIC: 'Cíclica',
  };
  return types[type] || type;
};

const formatFrequency = (frequency: string) => {
  const frequencies: Record<string, string> = {
    DAILY: 'Diária',
    WEEKLY: 'Semanal',
    MONTHLY: 'Mensal',
    QUARTERLY: 'Trimestral',
    YEARLY: 'Anual',
  };
  return frequencies[frequency] || frequency;
};

const formatStatus = (status: string) => {
  const statuses: Record<string, string> = {
    DRAFT: 'Rascunho',
    ACTIVE: 'Ativo',
    PAUSED: 'Pausado',
    COMPLETED: 'Concluído',
    CANCELLED: 'Cancelado',
  };
  return statuses[status] || status;
};

// Mesmas cores do antigo getStatusClass: gray/green/yellow/blue/red.
const getStatusTone = (status: string): BadgeTone => {
  const tones: Record<string, BadgeTone> = {
    DRAFT: 'neutral',
    ACTIVE: 'success',
    PAUSED: 'warning',
    COMPLETED: 'info',
    CANCELLED: 'danger',
  };
  return tones[status] || 'neutral';
};
</script>
