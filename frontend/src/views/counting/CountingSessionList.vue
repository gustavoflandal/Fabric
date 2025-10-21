<template>
  <div class="min-h-screen bg-gray-50">
    <AppHeader />

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Header -->
      <div class="mb-8">
        <h2 class="text-3xl font-bold text-gray-900">Sessões de Contagem</h2>
        <p class="mt-2 text-sm text-gray-600">
          Acompanhe e gerencie as sessões de contagem
        </p>
      </div>

      <!-- Filters -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select v-model="filters.status" class="w-full border-gray-300 rounded-md shadow-sm">
              <option value="">Todos</option>
              <option value="SCHEDULED">Agendada</option>
              <option value="IN_PROGRESS">Em Progresso</option>
              <option value="COMPLETED">Concluída</option>
              <option value="CANCELLED">Cancelada</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Data Início</label>
            <input
              v-model="filters.dateFrom"
              type="date"
              class="w-full border-gray-300 rounded-md shadow-sm"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Data Fim</label>
            <input
              v-model="filters.dateTo"
              type="date"
              class="w-full border-gray-300 rounded-md shadow-sm"
            />
          </div>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="flex justify-center items-center py-12">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>

      <!-- Sessions Grid -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          v-for="session in sessions"
          :key="session.id"
          class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
        >
          <!-- Header -->
          <div class="flex justify-between items-start mb-4">
            <div>
              <h3 class="text-lg font-semibold text-gray-900">{{ session.code }}</h3>
              <p class="text-sm text-gray-600">{{ session.plan?.name }}</p>
            </div>
            <span :class="getStatusClass(session.status)">
              {{ formatStatus(session.status) }}
            </span>
          </div>

          <!-- Info -->
          <div class="space-y-2 mb-4">
            <div class="flex justify-between text-sm">
              <span class="text-gray-600">Data:</span>
              <span class="font-medium">{{ formatDate(session.scheduledDate) }}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-gray-600">Responsável:</span>
              <span class="font-medium">{{ session.assignedTo?.name || '-' }}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-gray-600">Itens:</span>
              <span class="font-medium">{{ session.totalItems || 0 }}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-gray-600">Contados:</span>
              <span class="font-medium">{{ session.countedItems || 0 }}</span>
            </div>
          </div>

          <!-- Progress Bar -->
          <div v-if="session.status === 'IN_PROGRESS'" class="mb-4">
            <div class="flex justify-between text-xs text-gray-600 mb-1">
              <span>Progresso</span>
              <span>{{ Math.round((session.countedItems || 0) / (session.totalItems || 1) * 100) }}%</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2">
              <div
                class="bg-blue-600 h-2 rounded-full transition-all"
                :style="{ width: `${(session.countedItems || 0) / (session.totalItems || 1) * 100}%` }"
              ></div>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex space-x-2">
            <RouterLink
              v-if="session.status === 'IN_PROGRESS'"
              :to="`/counting/sessions/${session.id}/execute`"
              class="flex-1 text-center px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              Executar
            </RouterLink>
            <RouterLink
              v-if="session.status === 'COMPLETED'"
              :to="`/counting/sessions/${session.id}/report`"
              class="flex-1 text-center px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
            >
              Relatório
            </RouterLink>
            <button
              v-if="session.status === 'SCHEDULED'"
              @click="startSession(session.id)"
              class="flex-1 px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
            >
              Iniciar
            </button>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="sessions.length === 0 && !loading" class="text-center py-12">
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
        <h3 class="mt-2 text-sm font-medium text-gray-900">Nenhuma sessão encontrada</h3>
        <p class="mt-1 text-sm text-gray-500">As sessões são criadas automaticamente pelos planos ativos.</p>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useCountingStore } from '@/stores/counting.store';
import { storeToRefs } from 'pinia';
import AppHeader from '@/components/AppHeader.vue';

const router = useRouter();
const countingStore = useCountingStore();
const { sessions, loading } = storeToRefs(countingStore);

const filters = ref({
  status: '',
  dateFrom: '',
  dateTo: '',
});

onMounted(async () => {
  await loadSessions();
});

watch(filters, async () => {
  await loadSessions();
}, { deep: true });

const loadSessions = async () => {
  await countingStore.fetchSessions(filters.value);
};


const startSession = async (id: string) => {
  try {
    await countingStore.startSession(id);
    router.push(`/counting/sessions/${id}/execute`);
  } catch (error) {
    console.error('Erro ao iniciar sessão:', error);
  }
};

const formatDate = (dateString?: string) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const formatStatus = (status: string) => {
  const statuses: Record<string, string> = {
    SCHEDULED: 'Agendada',
    IN_PROGRESS: 'Em Progresso',
    COMPLETED: 'Concluída',
    CANCELLED: 'Cancelada',
  };
  return statuses[status] || status;
};

const getStatusClass = (status: string) => {
  const classes: Record<string, string> = {
    SCHEDULED: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800',
    IN_PROGRESS: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800',
    COMPLETED: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800',
    CANCELLED: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800',
  };
  return classes[status] || classes.SCHEDULED;
};
</script>
