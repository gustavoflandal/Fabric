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
        <Button v-if="(report?.divergences?.length ?? 0) > 0" variant="primary" @click="adjustStock">
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
          <p class="mt-1 text-sm text-gray-500">
            Um item com divergência precisa ser <strong>recontado</strong> ou ter a contagem <strong>aceita</strong> antes de entrar em "Ajustar Estoque" — só assim o sistema sabe qual quantidade final gravar.
          </p>
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
                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
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
                  {{ item.storagePosition?.code || '-' }}
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
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div v-if="item.status === 'COUNTED'" class="flex items-center justify-end gap-3">
                    <button @click="openRecountModal(item)" class="text-primary-600 hover:text-primary-900">Recontar</button>
                    <button @click="acceptDivergence(item)" class="text-green-600 hover:text-green-900">Aceitar</button>
                  </div>
                  <span v-else class="text-gray-400">—</span>
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

      <AppModal v-model="showRecountModal" title="Recontar Item" @close="closeRecountModal">
        <form id="recount-form" @submit.prevent="submitRecount" class="space-y-4">
          <div v-if="recountingItem">
            <p class="text-sm text-gray-600">{{ recountingItem.product?.code }} - {{ recountingItem.product?.name }}</p>
            <p class="text-sm text-gray-500">Quantidade do sistema: {{ recountingItem.systemQty }} · Primeira contagem: {{ recountingItem.countedQty }}</p>
          </div>
          <FormField id="recount-qty" label="Nova quantidade contada" required>
            <input
              v-model.number="recountQty"
              type="number"
              min="0"
              step="0.01"
              required
              class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
            />
          </FormField>
          <div class="flex gap-3 pt-4">
            <Button type="button" variant="outline" @click="closeRecountModal" class="flex-1">Cancelar</Button>
            <Button type="submit" class="flex-1">Confirmar Recontagem</Button>
          </div>
        </form>
      </AppModal>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useCountingStore } from '@/stores/counting.store';
import AppLayout from '@/components/common/AppLayout.vue';
import AppModal from '@/components/common/AppModal.vue';
import Button from '@/components/common/Button.vue';
import FormField from '@/components/common/FormField.vue';
import { CheckCircleIcon, DocumentArrowDownIcon } from '@heroicons/vue/24/outline';
import { useToast } from '@/composables/useToast';
import { confirmDialog } from '@/composables/useConfirm';

const route = useRoute();
const countingStore = useCountingStore();
const toast = useToast();

const loading = ref(false);
const error = ref('');
const report = ref<any>(null);

const showRecountModal = ref(false);
const recountingItem = ref<any>(null);
const recountQty = ref<number | null>(null);

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

// Exportação em CSV (aberto direto no Excel/LibreOffice) — sem dependência
// nova, é o formato mais simples que já cobre "levar a divergência pra fora
// do sistema pra analisar ou arquivar", que é o uso real do botão.
const exportReport = () => {
  if (!report.value) return;

  const rows = [
    ['Produto', 'Código', 'Localização', 'Qtd. Sistema', 'Qtd. Contada', 'Diferença', 'Diferença (%)', 'Status'],
    ...report.value.divergences.map((item: any) => [
      item.product?.name ?? '',
      item.product?.code ?? '',
      item.storagePosition?.code ?? '',
      item.systemQty,
      item.countedQty,
      item.difference,
      item.differencePercent,
      formatStatus(item.status),
    ]),
  ];

  const csv = rows
    .map((row) => row.map((cell: unknown) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(';'))
    .join('\r\n');

  // BOM UTF-8 na frente: sem ele o Excel abre acento corrompido.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `relatorio-contagem-${report.value.session?.code ?? route.params.id}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  toast.success('Relatório exportado!');
};

const openRecountModal = (item: any) => {
  recountingItem.value = item;
  recountQty.value = null;
  showRecountModal.value = true;
};

const closeRecountModal = () => {
  showRecountModal.value = false;
  recountingItem.value = null;
};

const submitRecount = async () => {
  if (!recountingItem.value || recountQty.value === null) return;
  try {
    await countingStore.recountItem(recountingItem.value.id, { recountQty: recountQty.value });
    toast.success('Recontagem registrada!');
    closeRecountModal();
    await loadReport();
  } catch (err: any) {
    toast.error(err.response?.data?.message || 'Erro ao registrar recontagem');
  }
};

const acceptDivergence = async (item: any) => {
  if (!(await confirmDialog(`Aceitar a contagem de ${item.countedQty} para ${item.product?.code} sem recontar?`))) {
    return;
  }
  try {
    await countingStore.acceptItem(item.id);
    toast.success('Contagem aceita!');
    await loadReport();
  } catch (err: any) {
    toast.error(err.response?.data?.message || 'Erro ao aceitar contagem');
  }
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
    COUNTED: 'Aguardando revisão',
    RECOUNTED: 'Recontado',
    ADJUSTED: 'Ajustado',
    CANCELLED: 'Cancelado',
  };
  return statuses[status] || status;
};

const getStatusClass = (status: string) => {
  const classes: Record<string, string> = {
    PENDING: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800',
    COUNTED: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800',
    RECOUNTED: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800',
    ADJUSTED: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800',
    CANCELLED: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800',
  };
  return classes[status] || classes.PENDING;
};
</script>
