<template>
  <AppLayout title="Novo Recebimento" subtitle="Registre o recebimento de um pedido de compra">
    <!-- Passo 1: selecionar o pedido -->
    <Card v-if="!selectedOrder" class="mb-6">
      <FormField id="receipt-order-search" label="Buscar Pedido de Compra" hint="Só pedidos Confirmados ou Parcialmente recebidos aparecem aqui.">
        <input
          v-model="orderSearch"
          type="text"
          placeholder="Número do pedido ou fornecedor..."
          class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
        />
      </FormField>

      <div v-if="loadingOrders" class="text-center py-8 text-gray-500">Carregando pedidos...</div>
      <div v-else-if="filteredOrders.length === 0" class="text-center py-8 text-gray-500">
        Nenhum pedido pendente de recebimento encontrado.
      </div>
      <div v-else class="mt-4 space-y-2">
        <button
          v-for="order in filteredOrders"
          :key="order.id"
          type="button"
          class="w-full text-left p-4 border border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50"
          @click="selectOrder(order)"
        >
          <div class="flex justify-between items-center">
            <div>
              <p class="font-medium text-gray-900">{{ order.orderNumber }} — {{ order.supplier?.name }}</p>
              <p class="text-sm text-gray-500">Pedido em {{ formatDate(order.orderDate) }}</p>
            </div>
            <StatusBadge :label="getOrderStatusLabel(order.status)" :tone="getOrderStatusTone(order.status)" />
          </div>
        </button>
      </div>
    </Card>

    <!-- Passo 2: itens do pedido + NFe -->
    <template v-else>
      <Card class="mb-6">
        <div class="flex justify-between items-start mb-4">
          <div>
            <h3 class="text-lg font-semibold text-gray-900">{{ selectedOrder.orderNumber }} — {{ selectedOrder.supplier?.name }}</h3>
            <p class="text-sm text-gray-500">Preencha a quantidade recebida por item, ou importe o XML da NFe.</p>
          </div>
          <button type="button" class="text-sm text-primary-600 hover:text-primary-900" @click="selectedOrder = null">
            Trocar pedido
          </button>
        </div>

        <div class="flex items-center gap-3 mb-4 p-4 bg-gray-50 rounded-lg">
          <FormField id="receipt-nfe-file" label="Importar XML de NFe (opcional)" class="flex-1">
            <input
              ref="nfeFileInput"
              type="file"
              accept=".xml"
              class="w-full text-sm"
              @change="handleNfeFileSelected"
            />
          </FormField>
        </div>

        <!-- Reconciliação da NFe: aparece só depois de um import bem-sucedido -->
        <div v-if="parsedNfe" class="mb-6 border border-blue-200 bg-blue-50 rounded-lg p-4">
          <p class="text-sm font-medium text-blue-900 mb-3">
            NFe {{ parsedNfe.number }}/{{ parsedNfe.series }} — {{ parsedNfe.supplierName }} ({{ parsedNfe.items.length }} itens).
            Associe cada item da nota a um item do pedido:
          </p>
          <div v-for="(nfeItem, idx) in parsedNfe.items" :key="idx" class="flex items-center gap-3 py-2 border-t border-blue-100 first:border-t-0">
            <div class="flex-1 text-sm">
              <span class="font-medium">{{ nfeItem.code }}</span> — {{ nfeItem.description }}
              ({{ nfeItem.quantity }} {{ nfeItem.unit }})
            </div>
            <select
              class="rounded-lg border-gray-300 shadow-sm text-sm"
              :value="nfeMatches[idx] ?? ''"
              @change="applyNfeMatch(idx, ($event.target as HTMLSelectElement).value)"
            >
              <option value="">Não corresponde a nenhum item</option>
              <option v-for="row in itemRows" :key="row.orderItemId" :value="row.orderItemId">
                {{ row.productLabel }} (pendente: {{ row.pending }})
              </option>
            </select>
          </div>
        </div>

        <!-- Itens do pedido -->
        <div class="space-y-4">
          <div v-for="row in itemRows" :key="row.orderItemId" class="border border-gray-200 rounded-lg p-4">
            <div class="flex justify-between items-start mb-3">
              <div>
                <p class="font-medium text-gray-900">{{ row.productLabel }}</p>
                <p class="text-sm text-gray-500">Pedido: {{ row.orderedQty }} | Já recebido: {{ row.receivedQty }} | Pendente: {{ row.pending }}</p>
              </div>
              <span v-if="row.nfeDivergence" class="text-xs font-medium text-orange-700 bg-orange-100 px-2 py-1 rounded">
                Quantidade da NFe ({{ row.nfeQuantity }}) excede o pendente — revise
              </span>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField :id="`receipt-item-qty-${row.orderItemId}`" label="Quantidade Recebida">
                <input
                  v-model.number="row.quantityReceived"
                  type="number"
                  min="0"
                  :max="row.pending"
                  step="0.01"
                  class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                />
              </FormField>
              <template v-if="row.lotTracked">
                <FormField :id="`receipt-item-lot-${row.orderItemId}`" label="Número do Lote" required>
                  <input
                    v-model="row.lotNumber"
                    type="text"
                    class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  />
                </FormField>
                <FormField :id="`receipt-item-expires-${row.orderItemId}`" label="Validade">
                  <input
                    v-model="row.expiresAt"
                    type="date"
                    class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  />
                </FormField>
              </template>
            </div>
          </div>
        </div>
      </Card>

      <Card class="mb-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField id="receipt-date" label="Data de Recebimento" required>
            <input
              v-model="receiptDate"
              type="date"
              required
              class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            />
          </FormField>
          <FormField id="receipt-invoice" label="Número da Nota Fiscal (opcional)">
            <input
              v-model="invoiceNumber"
              type="text"
              class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            />
          </FormField>
        </div>
        <FormField id="receipt-notes" label="Observações" class="mt-4">
          <textarea
            v-model="notes"
            rows="3"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
          ></textarea>
        </FormField>
      </Card>

      <div v-if="!createdReceipt" class="flex justify-end gap-3">
        <RouterLink
          to="/purchases/receipts"
          class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Cancelar
        </RouterLink>
        <Button :disabled="submitting || !hasAnyQuantity" @click="handleSubmit">
          {{ submitting ? 'Salvando...' : 'Registrar Recebimento' }}
        </Button>
      </div>

      <Card v-else class="text-center py-8">
        <p class="text-lg font-medium text-gray-900 mb-4">Recebimento {{ createdReceipt.receiptNumber }} registrado com sucesso!</p>
        <div class="flex justify-center gap-3">
          <Button variant="outline" @click="printCreatedReceipt">🖨️ Imprimir Comprovante</Button>
          <RouterLink
            to="/purchases/receipts"
            class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            Voltar para a Lista
          </RouterLink>
        </div>
      </Card>
    </template>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { usePurchaseOrderStore } from '@/stores/purchase-order.store';
import { usePurchaseReceiptStore } from '@/stores/purchase-receipt.store';
import type { PurchaseOrder } from '@/services/purchase-order.service';
import type { PurchaseReceipt, ParsedNfe } from '@/services/purchase-receipt.service';
import AppLayout from '@/components/common/AppLayout.vue';
import Card from '@/components/common/Card.vue';
import FormField from '@/components/common/FormField.vue';
import Button from '@/components/common/Button.vue';
import StatusBadge, { type BadgeTone } from '@/components/common/StatusBadge.vue';
import { generatePDF, formatDate as formatDatePDF } from '@/utils/pdf-generator';
import { useToast } from '@/composables/useToast';

const orderStore = usePurchaseOrderStore();
const receiptStore = usePurchaseReceiptStore();
const toast = useToast();

const loadingOrders = ref(false);
const availableOrders = ref<PurchaseOrder[]>([]);
const orderSearch = ref('');
const selectedOrder = ref<PurchaseOrder | null>(null);

const receiptDate = ref(new Date().toISOString().split('T')[0]);
const invoiceNumber = ref('');
const notes = ref('');
const submitting = ref(false);
const createdReceipt = ref<PurchaseReceipt | null>(null);

const nfeFileInput = ref<HTMLInputElement | null>(null);
const parsedNfe = ref<ParsedNfe | null>(null);
const nfeMatches = ref<Record<number, string>>({}); // índice do item da NFe -> orderItemId

interface ItemRow {
  orderItemId: string;
  productId: string;
  productLabel: string;
  orderedQty: number;
  receivedQty: number;
  pending: number;
  quantityReceived: number;
  lotTracked: boolean;
  lotNumber: string;
  expiresAt: string;
  nfeQuantity: number | null;
  nfeDivergence: boolean;
}

const itemRows = ref<ItemRow[]>([]);

onMounted(loadAvailableOrders);

async function loadAvailableOrders() {
  loadingOrders.value = true;
  try {
    await orderStore.fetchOrders();
    availableOrders.value = orderStore.orders.filter(
      (o) => o.status === 'CONFIRMED' || o.status === 'PARTIAL'
    );
  } catch (e: any) {
    toast.error(e.response?.data?.message || 'Erro ao carregar pedidos');
  } finally {
    loadingOrders.value = false;
  }
}

const filteredOrders = computed(() => {
  const term = orderSearch.value.trim().toLowerCase();
  if (!term) return availableOrders.value;
  return availableOrders.value.filter(
    (o) =>
      o.orderNumber.toLowerCase().includes(term) ||
      (o.supplier?.name || '').toLowerCase().includes(term)
  );
});

const ORDER_STATUS_TONES: Record<string, BadgeTone> = {
  CONFIRMED: 'info',
  PARTIAL: 'warning',
};
const ORDER_STATUS_LABELS: Record<string, string> = {
  CONFIRMED: 'Confirmado',
  PARTIAL: 'Parcial',
};
function getOrderStatusTone(status: string): BadgeTone {
  return ORDER_STATUS_TONES[status] || 'neutral';
}
function getOrderStatusLabel(status: string): string {
  return ORDER_STATUS_LABELS[status] || status;
}

function selectOrder(order: PurchaseOrder) {
  selectedOrder.value = order;
  itemRows.value = order.items.map((item) => ({
    orderItemId: item.id,
    productId: item.productId,
    productLabel: item.product ? `${item.product.code} - ${item.product.name}` : item.productId,
    orderedQty: item.quantity,
    receivedQty: item.receivedQty,
    pending: item.quantity - item.receivedQty,
    quantityReceived: 0,
    lotTracked: item.product?.lotTracked === true,
    lotNumber: '',
    expiresAt: '',
    nfeQuantity: null,
    nfeDivergence: false,
  }));
}

const hasAnyQuantity = computed(() => itemRows.value.some((row) => row.quantityReceived > 0));

async function handleNfeFileSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  try {
    const xml = await file.text();
    parsedNfe.value = await receiptStore.parseNfe(xml);
    nfeMatches.value = {};
    toast.success('NFe lida com sucesso. Associe os itens abaixo.');
  } catch (e: any) {
    toast.error(e.response?.data?.message || 'Erro ao ler o XML da NFe');
    parsedNfe.value = null;
  } finally {
    input.value = '';
  }
}

function applyNfeMatch(nfeItemIndex: number, orderItemId: string) {
  if (!parsedNfe.value) return;
  nfeMatches.value[nfeItemIndex] = orderItemId;
  if (!orderItemId) return;

  const nfeItem = parsedNfe.value.items[nfeItemIndex];
  const row = itemRows.value.find((r) => r.orderItemId === orderItemId);
  if (!row) return;

  row.nfeQuantity = nfeItem.quantity;
  row.nfeDivergence = nfeItem.quantity > row.pending;
  row.quantityReceived = row.nfeDivergence ? row.pending : nfeItem.quantity;
  if (row.lotTracked) {
    if (nfeItem.lotNumber) row.lotNumber = nfeItem.lotNumber;
    if (nfeItem.expiresAt) row.expiresAt = nfeItem.expiresAt;
  }
}

async function handleSubmit() {
  if (!selectedOrder.value) return;

  const itemsToSend = itemRows.value
    .filter((row) => row.quantityReceived > 0)
    .map((row) => ({
      orderItemId: row.orderItemId,
      productId: row.productId,
      quantityReceived: row.quantityReceived,
      lotNumber: row.lotTracked ? row.lotNumber : undefined,
      expiresAt: row.lotTracked && row.expiresAt ? row.expiresAt : undefined,
    }));

  if (itemsToSend.length === 0) {
    toast.error('Informe a quantidade recebida de ao menos um item');
    return;
  }

  const missingLot = itemsToSend.find((item) => {
    const row = itemRows.value.find((r) => r.orderItemId === item.orderItemId);
    return row?.lotTracked && !item.lotNumber;
  });
  if (missingLot) {
    toast.error('Informe o número do lote para os itens que exigem rastreabilidade');
    return;
  }

  submitting.value = true;
  try {
    createdReceipt.value = await receiptStore.createReceipt({
      purchaseOrderId: selectedOrder.value.id,
      receiptDate: receiptDate.value,
      invoiceNumber: invoiceNumber.value || undefined,
      notes: notes.value || undefined,
      items: itemsToSend,
    });
    toast.success('Recebimento registrado com sucesso!');
  } catch (e: any) {
    toast.error(e.response?.data?.message || 'Erro ao registrar recebimento');
  } finally {
    submitting.value = false;
  }
}

function printCreatedReceipt() {
  if (!createdReceipt.value) return;
  const receipt = createdReceipt.value;
  const pdf = generatePDF({
    title: 'Comprovante de Recebimento',
    subtitle: receipt.receiptNumber,
    data: {
      Pedido: selectedOrder.value?.orderNumber || '-',
      Fornecedor: selectedOrder.value?.supplier?.name || '-',
      Data: formatDatePDF(receiptDate.value),
      Observações: notes.value || 'Nenhuma',
    },
    items: itemRows.value
      .filter((row) => row.quantityReceived > 0)
      .map((row) => ({
        produto: row.productLabel,
        quantidade: row.quantityReceived,
        lote: row.lotNumber || '-',
      })),
    itemsColumns: [
      { header: 'Produto', key: 'produto', align: 'left' },
      { header: 'Quantidade', key: 'quantidade', align: 'right' },
      { header: 'Lote', key: 'lote', align: 'left' },
    ],
    signature: { label: 'Recebido por' },
  });
  pdf.save(`Recebimento_${receipt.receiptNumber}.pdf`);
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('pt-BR');
}
</script>
