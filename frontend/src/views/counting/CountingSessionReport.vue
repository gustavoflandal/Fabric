<template>
  <div class="min-h-screen bg-gray-50">
    <AppHeader />

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Header -->
      <div class="mb-8 flex justify-between items-center">
        <div>
          <h2 class="text-3xl font-bold text-gray-900">Relatório de Contagem</h2>
          <p class="mt-2 text-sm text-gray-600">
            {{ report?.session?.code }} - {{ report?.session?.plan?.name }}
          </p>
        </div>
        <div class="flex space-x-3">
          <button
            @click="exportReport"
            class="inline-flex items-center px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50"
          >
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Exportar
          </button>
          <button
            v-if="report?.hasDivergences"
            @click="adjustStock"
            class="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
          >
            Ajustar Estoque
          </button>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="flex justify-center items-center py-12">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
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
          <svg class="mx-auto h-16 w-16 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 class="mt-4 text-lg font-medium text-gray-900">Nenhuma Divergência Encontrada</h3>
          <p class="mt-2 text-sm text-gray-600">
            Todas as contagens estão de acordo com o sistema. Parabéns!
          </p>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useCountingStore } from '@/stores/counting.store';
import AppHeader from '@/components/AppHeader.vue';

const router = useRouter();
const route = useRoute();
const countingStore = useCountingStore();

const loading = ref(false);
const report = ref<any>(null);

onMounted(async () => {
  await loadReport();
});

const loadReport = async () => {
  try {
    loading.value = true;
    const sessionId = route.params.id as string;
    report.value = await countingStore.fetchSessionReport(sessionId);
  } catch (error) {
    console.error('Erro ao carregar relatório:', error);
  } finally {
    loading.value = false;
  }
};

const exportReport = () => {
  alert('Funcionalidade de exportação será implementada em breve.');
};

const adjustStock = async () => {
  if (!confirm('Deseja ajustar o estoque com base nas divergências encontradas?')) {
    return;
  }

  try {
    await countingStore.adjustStock(route.params.id as string);
    alert('Estoque ajustado com sucesso!');
    await loadReport();
  } catch (error) {
    console.error('Erro ao ajustar estoque:', error);
    alert('Erro ao ajustar estoque. Tente novamente.');
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
