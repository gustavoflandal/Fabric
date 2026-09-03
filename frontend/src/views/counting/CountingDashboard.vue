<template>
  <AppLayout
    title="Inventário"
    subtitle="Gerencie planos e acompanhe os inventários de estoque"
  >
    <template #actions>
      <RouterLink
        to="/counting/plans/new"
        class="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md shadow-sm"
      >
        <PlusIcon class="w-5 h-5 mr-2" />
        Novo Plano
      </RouterLink>
    </template>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center items-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>

    <!-- Erro (antes o onMounted nao tinha try/catch: qualquer falha virava
         unhandled rejection e a pagina ficava presa no spinner). -->
    <div v-else-if="dashboardError" class="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
      <p class="text-red-600">{{ dashboardError }}</p>
      <Button class="mt-4" @click="loadDashboardData">Tentar Novamente</Button>
    </div>

    <!-- Dashboard Content -->
    <div v-else-if="dashboard">
      <!-- Stats Cards -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <!-- Planos Ativos -->
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-600">Planos Ativos</p>
              <p class="text-3xl font-bold text-blue-600 mt-2">
                {{ dashboard.stats.activePlans }}
              </p>
            </div>
            <div class="p-3 bg-blue-100 rounded-full">
              <ClipboardDocumentListIcon class="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <!-- Sessões Ativas -->
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-600">Sessões Ativas</p>
              <p class="text-3xl font-bold text-green-600 mt-2">
                {{ dashboard.stats.activeSessions }}
              </p>
            </div>
            <div class="p-3 bg-green-100 rounded-full">
              <CheckCircleIcon class="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <!-- Itens Pendentes -->
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-600">Itens Pendentes</p>
              <p class="text-3xl font-bold text-orange-600 mt-2">
                {{ dashboard.stats.pendingItems }}
              </p>
            </div>
            <div class="p-3 bg-orange-100 rounded-full">
              <ClockIcon class="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>

        <!-- Acurácia Média -->
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-600">Acurácia Média</p>
              <p class="text-3xl font-bold text-purple-600 mt-2">
                {{ dashboard.stats.avgAccuracy }}%
              </p>
            </div>
            <div class="p-3 bg-purple-100 rounded-full">
              <ChartBarIcon class="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      <!-- Planos de Contagem -->
      <div class="mb-8">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Planos de Inventário</h3>

        <!-- Filters -->
        <Card class="mb-6">
          <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            <FormField id="counting-dashboard-filter-status" label="Status">
              <select v-model="filters.status" class="w-full border-gray-300 rounded-md shadow-sm">
                <option value="">Todos</option>
                <option value="DRAFT">Rascunho</option>
                <option value="ACTIVE">Ativo</option>
                <option value="PAUSED">Pausado</option>
                <option value="COMPLETED">Concluído</option>
                <option value="CANCELLED">Cancelado</option>
              </select>
            </FormField>
            <FormField id="counting-dashboard-filter-type" label="Tipo">
              <select v-model="filters.type" class="w-full border-gray-300 rounded-md shadow-sm">
                <option value="">Todos</option>
                <option value="FULL">Completa</option>
                <option value="PARTIAL">Parcial</option>
                <option value="CYCLIC">Cíclica</option>
              </select>
            </FormField>
            <FormField id="counting-dashboard-filter-frequency" label="Frequência">
              <select v-model="filters.frequency" class="w-full border-gray-300 rounded-md shadow-sm">
                <option value="">Todas</option>
                <option value="DAILY">Diária</option>
                <option value="WEEKLY">Semanal</option>
                <option value="MONTHLY">Mensal</option>
                <option value="QUARTERLY">Trimestral</option>
                <option value="YEARLY">Anual</option>
              </select>
            </FormField>
            <FormField id="counting-dashboard-filter-search" label="Buscar">
              <input
                v-model="filters.search"
                type="text"
                placeholder="Nome ou código..."
                class="w-full border-gray-300 rounded-md shadow-sm"
              />
            </FormField>
          </div>
        </Card>

        <!-- Plans Table — usa refs LOCAIS (plansLoading/plansError) e nao o
             `loading` do store, que e compartilhado com fetchDashboard. -->
        <DataTable
          :loading="plansLoading"
          :error="plansError"
          :items="plans"
          empty-title="Nenhum plano encontrado"
          empty-hint="Comece criando um novo plano de inventário."
          @retry="loadPlans"
        >
          <template #head>
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
          </template>

          <template #row="{ item: plan }">
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
              <StatusBadge :label="formatStatus(plan.status)" :tone="getStatusTone(plan.status)" />
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
          </template>
        </DataTable>
      </div>

      <!-- Sessões Agendadas para Hoje -->
      <div v-if="dashboard.scheduledToday.length > 0" class="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
        <div class="px-6 py-4 border-b border-gray-200">
          <h2 class="text-lg font-semibold text-gray-900">Sessões Agendadas para Hoje</h2>
        </div>
        <div class="p-6">
          <div class="space-y-4">
            <div
              v-for="session in dashboard.scheduledToday"
              :key="session.id"
              class="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div class="flex-1">
                <div class="flex items-center">
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {{ session.code }}
                  </span>
                  <h3 class="ml-3 text-sm font-medium text-gray-900">
                    {{ session.plan?.name }}
                  </h3>
                </div>
                <div class="mt-2 flex items-center text-sm text-gray-500">
                  <ClockIcon class="mr-1.5 h-4 w-4" />
                  {{ formatTime(session.scheduledDate) }}
                  <span v-if="session.assignedUser" class="ml-4 flex items-center">
                    <UserIcon class="mr-1.5 h-4 w-4" />
                    {{ session.assignedUser.name }}
                  </span>
                </div>
              </div>
              <RouterLink
                :to="`/counting/sessions/${session.id}`"
                class="ml-4 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Ver Detalhes
              </RouterLink>
            </div>
          </div>
        </div>
      </div>

      <!-- Divergências Recentes — sub-display do payload ja carregado, sem
           estado de carga proprio: segue como <table> simples (precedente
           dos lotes 4/5 para tabelas aninhadas). -->
      <div v-if="dashboard.recentDivergences.length > 0" class="bg-white rounded-lg shadow-sm border border-gray-200">
        <div class="px-6 py-4 border-b border-gray-200">
          <h2 class="text-lg font-semibold text-gray-900">Divergências Recentes</h2>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Produto
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sistema
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contado
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Diferença
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="item in dashboard.recentDivergences" :key="item.id" class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm font-medium text-gray-900">{{ item.product?.code }}</div>
                  <div class="text-sm text-gray-500">{{ item.product?.name }}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {{ item.systemQty }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {{ item.countedQty }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <StatusBadge
                    :label="formatDivergence(item)"
                    :tone="Number(item.difference) < 0 ? 'danger' : 'success'"
                  />
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ formatDate(item.countedAt) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { useCountingStore } from '@/stores/counting.store';
import { storeToRefs } from 'pinia';
import type { PlanFilters } from '@/types/counting.types';
import AppLayout from '@/components/common/AppLayout.vue';
import Button from '@/components/common/Button.vue';
import Card from '@/components/common/Card.vue';
import DataTable from '@/components/common/DataTable.vue';
import FormField from '@/components/common/FormField.vue';
import StatusBadge, { type BadgeTone } from '@/components/common/StatusBadge.vue';
import {
  ChartBarIcon,
  CheckCircleIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
  PlusIcon,
  UserIcon,
} from '@heroicons/vue/24/outline';
import { useToast } from '@/composables/useToast';

const toast = useToast();
const countingStore = useCountingStore();
const { dashboard, plans, loading } = storeToRefs(countingStore);

const filters = ref<PlanFilters>({
  status: '',
  type: '',
  frequency: '',
  search: '',
});

// Erro de pagina (dashboard) e erro da tabela de planos sao separados: o
// segundo dispara a cada troca de filtro e nao pode derrubar a pagina toda.
const dashboardError = ref('');
const plansLoading = ref(false);
const plansError = ref('');

onMounted(async () => {
  await loadDashboardData();
});

const loadDashboardData = async () => {
  dashboardError.value = '';
  try {
    await Promise.all([
      countingStore.fetchDashboard(),
      loadPlans()
    ]);
  } catch (error: any) {
    dashboardError.value =
      error.response?.data?.message || error.message || 'Erro ao carregar o dashboard de inventário';
  }
};

watch(filters, async () => {
  await loadPlans();
}, { deep: true });

const loadPlans = async () => {
  plansError.value = '';
  plansLoading.value = true;
  try {
    await countingStore.fetchPlans(filters.value);
  } catch (error: any) {
    plansError.value =
      error.response?.data?.message || error.message || 'Erro ao carregar planos';
  } finally {
    plansLoading.value = false;
  }
};

const activatePlan = async (id: string) => {
  try {
    await countingStore.activatePlan(id);
    await loadPlans();
    await countingStore.fetchDashboard();
  } catch (error: any) {
    toast.error(error.response?.data?.message || 'Erro ao ativar plano');
  }
};

const pausePlan = async (id: string) => {
  try {
    await countingStore.pausePlan(id);
    await loadPlans();
    await countingStore.fetchDashboard();
  } catch (error: any) {
    toast.error(error.response?.data?.message || 'Erro ao pausar plano');
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

const formatDivergence = (item: any) => {
  const sign = Number(item.difference) > 0 ? '+' : '';
  const percent = Number(item.differencePercent || 0).toFixed(1);
  return `${sign}${item.difference} (${percent}%)`;
};

const formatTime = (dateString?: string) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

const formatDate = (dateString?: string) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
</script>
