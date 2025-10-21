<template>
  <div class="min-h-screen bg-gray-50">
    <AppHeader />

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Header -->
      <div class="mb-8 flex justify-between items-center">
        <div>
          <h2 class="text-3xl font-bold text-gray-900">Planos de Contagem</h2>
          <p class="mt-2 text-sm text-gray-600">
            Gerencie os planos de contagem de estoque
          </p>
        </div>
        <RouterLink
          to="/counting/plans/new"
          class="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md shadow-sm"
        >
          <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Novo Plano
        </RouterLink>
      </div>

      <!-- Filters -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select v-model="filters.status" class="w-full border-gray-300 rounded-md shadow-sm">
              <option value="">Todos</option>
              <option value="DRAFT">Rascunho</option>
              <option value="ACTIVE">Ativo</option>
              <option value="PAUSED">Pausado</option>
              <option value="COMPLETED">Concluído</option>
              <option value="CANCELLED">Cancelado</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select v-model="filters.type" class="w-full border-gray-300 rounded-md shadow-sm">
              <option value="">Todos</option>
              <option value="FULL">Completa</option>
              <option value="PARTIAL">Parcial</option>
              <option value="CYCLIC">Cíclica</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Frequência</label>
            <select v-model="filters.frequency" class="w-full border-gray-300 rounded-md shadow-sm">
              <option value="">Todas</option>
              <option value="DAILY">Diária</option>
              <option value="WEEKLY">Semanal</option>
              <option value="MONTHLY">Mensal</option>
              <option value="QUARTERLY">Trimestral</option>
              <option value="YEARLY">Anual</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
            <input
              v-model="filters.search"
              type="text"
              placeholder="Nome ou código..."
              class="w-full border-gray-300 rounded-md shadow-sm"
            />
          </div>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="flex justify-center items-center py-12">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>

      <!-- Plans Table -->
      <div v-else class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Código
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Nome
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tipo
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Frequência
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ações
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="plan in plans" :key="plan.id" class="hover:bg-gray-50">
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                {{ plan.code }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {{ plan.name }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                {{ formatType(plan.type) }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                {{ formatFrequency(plan.frequency) }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span :class="getStatusClass(plan.status)">
                  {{ formatStatus(plan.status) }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                <div class="flex space-x-2">
                  <RouterLink
                    :to="`/counting/plans/${plan.id}`"
                    class="text-blue-600 hover:text-blue-900"
                  >
                    Ver
                  </RouterLink>
                  <button
                    v-if="plan.status === 'DRAFT'"
                    @click="activatePlan(plan.id)"
                    class="text-green-600 hover:text-green-900"
                  >
                    Ativar
                  </button>
                  <button
                    v-if="plan.status === 'ACTIVE'"
                    @click="pausePlan(plan.id)"
                    class="text-yellow-600 hover:text-yellow-900"
                  >
                    Pausar
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Empty State -->
        <div v-if="plans.length === 0" class="text-center py-12">
          <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <h3 class="mt-2 text-sm font-medium text-gray-900">Nenhum plano encontrado</h3>
          <p class="mt-1 text-sm text-gray-500">Comece criando um novo plano de contagem.</p>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useCountingStore } from '@/stores/counting.store';
import { storeToRefs } from 'pinia';
import type { PlanFilters } from '@/types/counting.types';
import AppHeader from '@/components/AppHeader.vue';

const router = useRouter();
const countingStore = useCountingStore();
const { plans, loading } = storeToRefs(countingStore);

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
  await countingStore.fetchPlans(filters.value);
};

const activatePlan = async (id: string) => {
  try {
    await countingStore.activatePlan(id);
    await loadPlans();
  } catch (error) {
    console.error('Erro ao ativar plano:', error);
  }
};

const pausePlan = async (id: string) => {
  try {
    await countingStore.pausePlan(id);
    await loadPlans();
  } catch (error) {
    console.error('Erro ao pausar plano:', error);
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

const getStatusClass = (status: string) => {
  const classes: Record<string, string> = {
    DRAFT: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800',
    ACTIVE: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800',
    PAUSED: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800',
    COMPLETED: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800',
    CANCELLED: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800',
  };
  return classes[status] || classes.DRAFT;
};
</script>
