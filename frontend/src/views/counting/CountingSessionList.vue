<template>
  <AppLayout title="Sessões de Inventário" subtitle="Acompanhe e gerencie as sessões de inventário">
    <!-- Filters -->
    <Card class="mb-6">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormField id="counting-sessions-filter-status" label="Status">
          <select v-model="filters.status" class="w-full border-gray-300 rounded-md shadow-sm">
            <option value="">Todos</option>
            <option value="SCHEDULED">Agendada</option>
            <option value="IN_PROGRESS">Em Progresso</option>
            <option value="COMPLETED">Concluída</option>
            <option value="CANCELLED">Cancelada</option>
          </select>
        </FormField>
        <FormField id="counting-sessions-filter-date-from" label="Data Início">
          <input
            v-model="filters.dateFrom"
            type="date"
            class="w-full border-gray-300 rounded-md shadow-sm"
          />
        </FormField>
        <FormField id="counting-sessions-filter-date-to" label="Data Fim">
          <input
            v-model="filters.dateTo"
            type="date"
            class="w-full border-gray-300 rounded-md shadow-sm"
          />
        </FormField>
      </div>
    </Card>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center items-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>

    <!-- Erro — antes uma falha em loadSessions nao aparecia em lugar nenhum
         e a grade ficava vazia como se nao houvesse sessoes (I11). -->
    <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
      <p class="text-red-600">{{ error }}</p>
      <Button class="mt-4" @click="loadSessions">Tentar Novamente</Button>
    </div>

    <!-- Sessions Grid (grade de cards, nao tabela: DataTable nao se aplica) -->
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
          <StatusBadge
            :label="formatStatus(session.status)"
            :tone="getStatusTone(session.status)"
          />
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
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useCountingStore } from '@/stores/counting.store';
import { storeToRefs } from 'pinia';
import AppLayout from '@/components/common/AppLayout.vue';
import Button from '@/components/common/Button.vue';
import Card from '@/components/common/Card.vue';
import FormField from '@/components/common/FormField.vue';
import StatusBadge, { type BadgeTone } from '@/components/common/StatusBadge.vue';
import { useToast } from '@/composables/useToast';

const toast = useToast();
const router = useRouter();
const countingStore = useCountingStore();
const { sessions, loading } = storeToRefs(countingStore);

const error = ref('');

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
  error.value = '';
  try {
    await countingStore.fetchSessions(filters.value);
  } catch (err: any) {
    error.value = err.response?.data?.message || err.message || 'Erro ao carregar sessões';
  }
};


const startSession = async (id: string) => {
  try {
    await countingStore.startSession(id);
    router.push(`/counting/sessions/${id}/execute`);
  } catch (err: any) {
    toast.error(err.response?.data?.message || 'Erro ao iniciar sessão');
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

// Mesmas cores do antigo getStatusClass: yellow/blue/green/red.
const getStatusTone = (status: string): BadgeTone => {
  const tones: Record<string, BadgeTone> = {
    SCHEDULED: 'warning',
    IN_PROGRESS: 'info',
    COMPLETED: 'success',
    CANCELLED: 'danger',
  };
  return tones[status] || 'warning';
};
</script>
