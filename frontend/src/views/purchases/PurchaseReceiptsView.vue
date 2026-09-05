<template>
  <AppLayout title="Recebimentos" subtitle="Consulte e gerencie os recebimentos de mercadorias">
    <template #actions>
      <RouterLink
        to="/purchases/receipts/new"
        class="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md shadow-sm"
      >
        + Novo Recebimento
      </RouterLink>
    </template>

    <DataTable
      :loading="loading"
      :error="error"
      :items="receipts"
      empty-title="Nenhum recebimento encontrado"
      empty-hint="Registre o recebimento de um pedido de compra pendente."
      @retry="loadReceipts"
    >
      <template #head>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Número</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pedido</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status do Pedido</th>
        <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
      </template>

      <template #row="{ item }">
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ item.receiptNumber }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{{ item.order?.orderNumber || '-' }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{{ formatDate(item.receiptDate) }}</td>
        <td class="px-6 py-4 whitespace-nowrap">
          <StatusBadge :label="getOrderStatusLabel(item.order?.status)" :tone="getOrderStatusTone(item.order?.status)" />
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-right text-sm">
          <div class="flex justify-end gap-3">
            <button class="text-primary-600 hover:text-primary-900 font-medium" @click="printReceipt(item)">
              Imprimir
            </button>
            <button class="text-red-600 hover:text-red-900 font-medium" @click="handleCancel(item)">
              Cancelar
            </button>
          </div>
        </td>
      </template>
    </DataTable>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { usePurchaseReceiptStore } from '@/stores/purchase-receipt.store';
import type { PurchaseReceipt } from '@/services/purchase-receipt.service';
import AppLayout from '@/components/common/AppLayout.vue';
import DataTable from '@/components/common/DataTable.vue';
import StatusBadge, { type BadgeTone } from '@/components/common/StatusBadge.vue';
import { generatePDF, formatDate as formatDatePDF } from '@/utils/pdf-generator';
import { useToast } from '@/composables/useToast';
import { confirmDialog } from '@/composables/useConfirm';

const receiptStore = usePurchaseReceiptStore();
const toast = useToast();

const receipts = ref<PurchaseReceipt[]>([]);
const loading = ref(false);
const error = ref('');

onMounted(loadReceipts);

async function loadReceipts() {
  loading.value = true;
  error.value = '';
  try {
    await receiptStore.fetchReceipts();
    receipts.value = receiptStore.receipts;
  } catch (e: any) {
    error.value = e.response?.data?.message || e.message || 'Erro ao carregar recebimentos';
  } finally {
    loading.value = false;
  }
}

// Mesmo mapeamento de cor de PurchaseOrder.status usado em PurchaseOrdersView.
const ORDER_STATUS_TONES: Record<string, BadgeTone> = {
  PENDING: 'neutral',
  CONFIRMED: 'info',
  PARTIAL: 'warning',
  RECEIVED: 'success',
  CANCELLED: 'danger',
};

const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendente',
  CONFIRMED: 'Confirmado',
  PARTIAL: 'Parcial',
  RECEIVED: 'Recebido',
  CANCELLED: 'Cancelado',
};

function getOrderStatusTone(status?: string): BadgeTone {
  return (status && ORDER_STATUS_TONES[status]) || 'neutral';
}

function getOrderStatusLabel(status?: string): string {
  return (status && ORDER_STATUS_LABELS[status]) || status || '-';
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('pt-BR');
}

function printReceipt(receipt: PurchaseReceipt) {
  const pdf = generatePDF({
    title: 'Comprovante de Recebimento',
    subtitle: receipt.receiptNumber,
    data: {
      Pedido: receipt.order?.orderNumber || '-',
      Fornecedor: receipt.order?.supplier?.name || '-',
      Data: formatDatePDF(receipt.receiptDate),
      Observações: receipt.notes || 'Nenhuma',
    },
    items: receipt.items.map((item) => ({
      produto: item.product ? `${item.product.code} - ${item.product.name}` : item.productId,
      quantidade: item.quantity,
      aceito: item.acceptedQty,
      lote: item.lotNumber || '-',
    })),
    itemsColumns: [
      { header: 'Produto', key: 'produto', align: 'left' },
      { header: 'Quantidade', key: 'quantidade', align: 'right' },
      { header: 'Aceito', key: 'aceito', align: 'right' },
      { header: 'Lote', key: 'lote', align: 'left' },
    ],
    signature: { label: 'Recebido por' },
  });

  pdf.save(`Recebimento_${receipt.receiptNumber}.pdf`);
}

async function handleCancel(receipt: PurchaseReceipt) {
  if (!(await confirmDialog(`Cancelar o recebimento ${receipt.receiptNumber}? Esta ação estorna o estoque recebido.`))) {
    return;
  }
  const reason = 'Cancelado pelo usuário';
  try {
    await receiptStore.cancelReceipt(receipt.id, reason);
    toast.success('Recebimento cancelado com sucesso!');
    await loadReceipts();
  } catch (e: any) {
    toast.error(e.response?.data?.message || 'Erro ao cancelar recebimento');
  }
}
</script>
