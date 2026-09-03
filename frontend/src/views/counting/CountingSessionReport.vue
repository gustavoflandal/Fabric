<template>
  <AppLayout
    title="Relatório de Inventário"
    :subtitle="reportSubtitle"
  >
    <template #actions>
      <div class="flex space-x-3">
        <Button variant="outline" @click="exportReport">
          <DocumentArrowDownIcon class="w-5 h-5 mr-2" />
          Exportar
        </Button>
        <Button v-if="report?.hasDivergences" variant="primary" @click="adjustStock">
          Ajustar Estoque
        </Button>
      </div>
    </template>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center items-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>

    <!-- Erro — antes so havia um toast, que sumia e deixava a pagina em branco. -->
    <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
      <p class="text-red-600">{{ error }}</p>
      <Button class="mt-4" @click="loadReport">Tentar Novamente</Button>
    </div>

    <!-- Report Content -->
    <div v-else-if="report" class="space-y-6">
      <!-- Summary Cards -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p class="text-sm font-medium text-gray-600">Total de Itens</p>
          <p class="text-3xl font-bold text-gray-900 mt-2">{{ report.summary.totalItems }}</p>
        </div>
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p class="text-sm font-medium text-gray-600">Itens Contados</p>
          <p class="text-3xl font-bold text-blue-600 mt-2">{{ report.summary.countedItems }}</p>
        </div>
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p class="text-sm font-medium text-gray-600">Divergências</p>
          <p class="text-3xl font-bold text-red-600 mt-2">{{ report.summary.divergences }}</p>
        </div>
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p class="text-sm font-medium text-gray-600">Acurácia</p>
          <p class="text-3xl font-bold text-green-600 mt-2">{{ report.summary.accuracy }}%</p>
        </div>
      </div>

      <!-- Divergences Table -->
      <div v-if="report.divergences.length > 0" class="bg-white rounded-lg shadow-sm border border-gray-200">
        <div class="px-6 py-4 border-b border-gray-200">
          <h3 class="text-lg font-semibold text-gray-900">Divergências Encontradas</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Produto
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Localização
                </th>
                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Qtd. Sistema
                </th>
                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Qtd. Contada
                </th>
                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Diferença
                </th>
                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  %
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="item in report.divergences" :key="item.id" class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm font-medium text-gray-900">{{ item.product?.code }}</div>
                  <div class="text-sm text-gray-500">{{ item.product?.name }}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {{ item.location?.code }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                  {{ item.systemQty }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                  {{ item.countedQty }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-right">
                  <span :class="[
                    'font-medium',
                    Number(item.difference) < 0 ? 'text-red-600' : 'text-green-600'
                  ]">
                    {{ Number(item.difference) > 0 ? '+' : '' }}{{ item.difference }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-right">
                  <span :class="[
                    'font-medium',
                    Math.abs(Number(item.differencePercent)) > 10 ? 'text-red-600' : 'text-yellow-600'
                  ]">
                    {{ Number(item.differencePercent || 0).toFixed(1) }}%
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span :class="getStatusClass(item.status)">
                    {{ formatStatus(item.status) }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- No Divergences -->
      <div v-else class="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <CheckCircleIcon class="mx-auto h-16 w-16 text-green-600" />
        <h3 class="mt-4 text-lg font-medium text-gray-900">Nenhuma Divergência Encontrada</h3>
        <p class="mt-2 text-sm text-gray-600">
          Todas as contagens estão de acordo com o sistema. Parabéns!
        </p>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useCountingStore } from '@/stores/counting.store';
import AppLayout from '@/components/common/AppLayout.vue';
import Button from '@/components/common/Button.vue';
import { CheckCircleIcon, DocumentArrowDownIcon } from '@heroicons/vue/24/outline';
import { useToast } from '@/composables/useToast';
import { confirmDialog } from '@/composables/useConfirm';

const route = useRoute();
const countingStore = useCountingStore();
const toast = useToast();

const loading = ref(false);
const error = ref('');
const report = ref<any>(null);

// Interpolacao literal (`${a} - ${b}`) imprimiria "undefined" enquanto o
// relatorio nao chega; o original usava dois {{ }} soltos, que renderizam vazio.
const reportSubtitle = computed(() => {
  const code = report.value?.session?.code;
  const planName = report.value?.session?.plan?.name;
  if (!code && !planName) return '';
  return `${code || ''} - ${planName || ''}`;
});

onMounted(async () => {
  await loadReport();
});

const loadReport = async () => {
  try {
    loading.value = true;
    error.value = '';
    const sessionId = route.params.id as string;
    report.value = await countingStore.fetchSessionReport(sessionId);
  } catch (err: any) {
    error.value = err.response?.data?.message || 'Erro ao carregar relatório';
    toast.error(error.value);
  } finally {
    loading.value = false;
  }
};

const exportReport = () => {
  toast.info('Funcionalidade de exportação será implementada em breve.');
};

const adjustStock = async () => {
  if (!(await confirmDialog('Deseja ajustar o estoque com base nas divergências encontradas?'))) {
    return;
  }

  try {
    await countingStore.adjustStock(route.params.id as string);
    toast.success('Estoque ajustado com sucesso!');
    await loadReport();
  } catch (err) {
    console.error('Erro ao ajustar estoque:', err);
    toast.error('Erro ao ajustar estoque. Tente novamente.');
  }
};

const formatStatus = (status: string) => {
  const statuses: Record<string, string> = {
    PENDING: 'Pendente',
    COUNTED: 'Contado',
    RECOUNTED: 'Recontado',
    ACCEPTED: 'Aceito',
    CANCELLED: 'Cancelado',
  };
  return statuses[status] || status;
};

const getStatusClass = (status: string) => {
  const classes: Record<string, string> = {
    PENDING: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800',
    COUNTED: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800',
    RECOUNTED: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800',
    ACCEPTED: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800',
    CANCELLED: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800',
  };
  return classes[status] || classes.PENDING;
};
</script>
