<template>
  <AppLayout title="Pedidos de Compra" subtitle="Gerencie pedidos de compra">
    <template #actions>
      <Button variant="primary" @click="showCreateModal = true"><span class="mr-2">+</span>Novo Pedido</Button>
    </template>

    <Card class="mb-6">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormField id="pos-filter-search" label="Buscar" class="md:col-span-2">
          <input
            v-model="filters.search"
            type="text"
            placeholder="Buscar..."
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            @input="debouncedLoadOrders"
          />
        </FormField>
        <FormField id="pos-filter-status" label="Status">
          <select
            v-model="filters.status"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            @change="loadOrders"
          >
            <option value="">Todos os Status</option>
            <option value="PENDING">Pendente</option>
            <option value="CONFIRMED">Confirmado</option>
            <option value="PARTIAL">Parcial</option>
            <option value="RECEIVED">Recebido</option>
            <option value="CANCELLED">Cancelado</option>
          </select>
        </FormField>
      </div>
    </Card>

    <DataTable
      :loading="loading"
      :error="error"
      :items="orders"
      empty-title="Nenhum pedido encontrado"
      empty-hint="Ajuste os filtros ou crie um novo pedido de compra."
      @retry="loadOrders"
    >
      <template #empty-action>
        <Button @click="showCreateModal = true"><span class="mr-2">+</span>Novo Pedido</Button>
      </template>

      <template #head>
        <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-36">Número</th>
        <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">Fornecedor</th>
        <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">Data</th>
        <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">Previsão</th>
        <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">Status</th>
        <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Valor Total</th>
        <th scope="col" class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-48">Ações</th>
      </template>

      <template #row="{ item }">
        <td class="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ item.orderNumber }}</td>
        <td class="px-4 py-4 text-sm text-gray-900">{{ item.supplier?.name }}</td>
        <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{{ formatDate(item.orderDate) }}</td>
        <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{{ formatDate(item.expectedDate) }}</td>
        <td class="px-4 py-4 whitespace-nowrap">
          <StatusBadge :label="getStatusLabel(item.status)" :tone="getStatusTone(item.status)" />
        </td>
        <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{{ formatCurrency(item.totalValue) }}</td>
        <td class="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
          <div class="flex items-center justify-end space-x-3">
            <button @click="viewOrder(item)" class="text-primary-600 hover:text-primary-900 whitespace-nowrap">Ver</button>
            <button
              v-if="item.status === 'PENDING'"
              @click="confirmOrder(item.id)"
              class="text-primary-600 hover:text-primary-900 whitespace-nowrap"
            >
              Confirmar
            </button>
            <button
              v-if="item.status !== 'RECEIVED' && item.status !== 'CANCELLED'"
              @click="cancelOrder(item.id)"
              class="text-red-600 hover:text-red-900 whitespace-nowrap"
            >
              Cancelar
            </button>
          </div>
        </td>
      </template>
    </DataTable>

    <!-- Modal Criar — Esc/focus trap agora vêm do AppModal (§4.2). -->
    <AppModal v-model="showCreateModal" size="lg" title="Novo Pedido de Compra">
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <FormField id="pos-form-supplier" label="Fornecedor" required>
          <select v-model="form.supplierId" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500">
            <option value="">Selecione...</option>
            <option v-for="supplier in suppliers" :key="supplier.id" :value="supplier.id">
              {{ supplier.name }}
            </option>
          </select>
        </FormField>

        <div class="grid grid-cols-2 gap-4">
          <FormField id="pos-form-expected-date" label="Data de Entrega Prevista" required>
            <input v-model="form.expectedDate" type="date" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
          </FormField>
          <FormField id="pos-form-payment-method" label="Forma de Pagamento">
            <input v-model="form.paymentMethod" type="text" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
          </FormField>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <FormField id="pos-form-shipping-cost" label="Frete (R$)">
            <input v-model.number="form.shippingCost" type="number" step="0.01" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
          </FormField>
          <FormField id="pos-form-discount" label="Desconto (R$)">
            <input v-model.number="form.discount" type="number" step="0.01" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
          </FormField>
        </div>

        <FormField id="pos-form-notes" label="Observações">
          <textarea v-model="form.notes" rows="3" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"></textarea>
        </FormField>

        <!-- Itens — seção agrupada no padrão de ProductsView/ProductionOrdersView (§5.2).
             Cada linha é uma tupla do array `form.items`, não um campo nomeado: envolvê-la
             em FormField geraria um id/label por controle por linha (dezenas de labels
             repetidos, `for` apontando para controles que mudam de índice a cada remoção),
             que é justamente o que o componente existe para evitar. O rótulo de grupo
             abaixo cobre a seção inteira. -->
        <div class="border-t pt-4 mt-4">
          <div class="flex justify-between items-center mb-2">
            <h4 class="text-sm font-semibold text-gray-900">Itens</h4>
            <Button type="button" size="sm" @click="addItem">+ Adicionar Item</Button>
          </div>

          <div v-for="(item, index) in form.items" :key="index" class="flex gap-2 mb-2">
            <select v-model="item.productId" required aria-label="Produto" class="flex-1 rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500">
              <option value="">Produto...</option>
              <option v-for="product in products" :key="product.id" :value="product.id">
                {{ product.code }} - {{ product.name }}
              </option>
            </select>
            <input v-model.number="item.quantity" type="number" placeholder="Qtd" required aria-label="Quantidade" class="w-24 rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
            <input v-model.number="item.unitPrice" type="number" step="0.01" placeholder="Preço" required aria-label="Preço unitário" class="w-32 rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
            <Button type="button" variant="danger" size="sm" @click="removeItem(index)">X</Button>
          </div>
        </div>

        <div class="flex gap-3 pt-4">
          <Button type="button" variant="outline" @click="showCreateModal = false" class="flex-1">Cancelar</Button>
          <Button type="submit" :disabled="submitting" class="flex-1">{{ submitting ? 'Salvando...' : 'Salvar' }}</Button>
        </div>
      </form>
    </AppModal>

    <!-- Modal de Visualização -->
    <AppModal v-model="showViewModal" size="lg" title="Detalhes do Pedido de Compra">
      <div v-if="selectedOrder" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <p class="block text-sm font-medium text-gray-700">Número</p>
            <p class="mt-1 text-sm text-gray-900">{{ selectedOrder.orderNumber }}</p>
          </div>
          <div>
            <p class="block text-sm font-medium text-gray-700">Status</p>
            <StatusBadge
              class="mt-1"
              :label="getStatusLabel(selectedOrder.status)"
              :tone="getStatusTone(selectedOrder.status)"
            />
          </div>
          <div>
            <p class="block text-sm font-medium text-gray-700">Fornecedor</p>
            <p class="mt-1 text-sm text-gray-900">{{ selectedOrder.supplier?.name }}</p>
          </div>
          <div>
            <p class="block text-sm font-medium text-gray-700">Data do Pedido</p>
            <p class="mt-1 text-sm text-gray-900">{{ formatDate(selectedOrder.orderDate) }}</p>
          </div>
          <div>
            <p class="block text-sm font-medium text-gray-700">Data Esperada</p>
            <p class="mt-1 text-sm text-gray-900">{{ formatDate(selectedOrder.expectedDate) }}</p>
          </div>
          <div>
            <p class="block text-sm font-medium text-gray-700">Valor Total</p>
            <p class="mt-1 text-sm font-bold text-gray-900">{{ formatCurrency(selectedOrder.totalValue) }}</p>
          </div>
          <div v-if="selectedOrder.approvedBy">
            <p class="block text-sm font-medium text-gray-700">Aprovado por</p>
            <p class="mt-1 text-sm text-gray-900">{{ selectedOrder.approvedBy }}</p>
          </div>
        </div>

        <div v-if="selectedOrder.notes">
          <p class="block text-sm font-medium text-gray-700">Observações</p>
          <p class="mt-1 text-sm text-gray-900">{{ selectedOrder.notes }}</p>
        </div>

        <!-- Itens do pedido: tabela simples, não DataTable. O modal só abre depois de
             `getOrderById` resolver, então 2 dos 4 estados de DataTable (carregando, erro)
             são inalcançáveis aqui — diferente do modal de posições de WarehouseStructuresView
             (Lote 2), onde a lista é buscada com loading/erro próprios. -->
        <div class="border-t pt-4 mt-4">
          <h4 class="text-sm font-semibold text-gray-900 mb-2">Itens</h4>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th scope="col" class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Produto</th>
                  <th scope="col" class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Quantidade</th>
                  <th scope="col" class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Recebido</th>
                  <th scope="col" class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Preço Unit.</th>
                  <th scope="col" class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-for="item in selectedOrder.items" :key="item.id">
                  <td class="px-4 py-2 text-sm text-gray-900">{{ item.product?.code }} - {{ item.product?.name }}</td>
                  <td class="px-4 py-2 text-sm text-right text-gray-900">{{ item.quantity }}</td>
                  <td class="px-4 py-2 text-sm text-right text-gray-900">{{ item.receivedQty || 0 }}</td>
                  <td class="px-4 py-2 text-sm text-right text-gray-900">{{ formatCurrency(item.unitPrice) }}</td>
                  <td class="px-4 py-2 text-sm text-right font-semibold text-gray-900">{{ formatCurrency(item.totalPrice) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-3">
          <Button type="button" variant="outline" @click="showViewModal = false">Fechar</Button>
          <Button
            v-if="selectedOrder && (selectedOrder.status === 'APPROVED' || selectedOrder.status === 'CONFIRMED')"
            variant="outline"
            @click="printOrderPDF(selectedOrder)"
          >
            📄 Imprimir PDF
          </Button>
          <Button
            v-if="selectedOrder && selectedOrder.status === 'PENDING'"
            variant="primary"
            @click="confirmOrder(selectedOrder.id)"
          >
            Confirmar Pedido
          </Button>
        </div>
      </template>
    </AppModal>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { usePurchaseOrderStore } from '@/stores/purchase-order.store';
import type { PurchaseOrder } from '@/services/purchase-order.service';
import AppLayout from '@/components/common/AppLayout.vue';
import AppModal from '@/components/common/AppModal.vue';
import Button from '@/components/common/Button.vue';
import Card from '@/components/common/Card.vue';
import DataTable from '@/components/common/DataTable.vue';
import FormField from '@/components/common/FormField.vue';
import StatusBadge, { type BadgeTone } from '@/components/common/StatusBadge.vue';
import { generatePDF, formatCurrency as formatCurrencyPDF, formatDate as formatDatePDF } from '@/utils/pdf-generator';
import { useToast } from '@/composables/useToast';
import { confirmDialog } from '@/composables/useConfirm';
import { useDebounce } from '@/composables/useDebounce';

const orderStore = usePurchaseOrderStore();
const toast = useToast();

const orders = ref<PurchaseOrder[]>([]);
const loading = ref(false);
// §4.4-5 / I11: erro de carregamento é um estado próprio, nunca "lista vazia".
const error = ref('');
const showCreateModal = ref(false);
const showViewModal = ref(false);
const selectedOrder = ref<PurchaseOrder | null>(null);
const submitting = ref(false);
const filters = ref({ search: '', status: '' });

const suppliers = ref<any[]>([]);
const products = ref<any[]>([]);

const form = ref({
  supplierId: '',
  expectedDate: '',
  paymentMethod: '',
  shippingCost: 0,
  discount: 0,
  notes: '',
  items: [{ productId: '', quantity: 0, unitPrice: 0 }],
});

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('pt-BR');
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

// yellow/blue/purple/green/red do badge antigo normalizados para a paleta do StatusBadge (§4.2):
// PENDING = warning (aguarda ação nossa), CONFIRMED = info (aceito, aguardando entrega),
// PARTIAL = warning (recebimento incompleto, ainda exige acompanhamento — não `neutral`,
// que leria como estado inerte), RECEIVED = success, CANCELLED = danger.
const getStatusTone = (status: string): BadgeTone => {
  const tones: Record<string, BadgeTone> = {
    PENDING: 'warning',
    CONFIRMED: 'info',
    PARTIAL: 'warning',
    RECEIVED: 'success',
    CANCELLED: 'danger',
  };
  return tones[status] || 'neutral';
};

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    PENDING: 'Pendente',
    CONFIRMED: 'Confirmado',
    PARTIAL: 'Parcial',
    RECEIVED: 'Recebido',
    CANCELLED: 'Cancelado',
  };
  return labels[status] || status;
};

const loadOrders = async () => {
  loading.value = true;
  error.value = '';
  try {
    const response = await orderStore.fetchOrders(filters.value);
    orders.value = response.data;
  } catch (e: any) {
    error.value = e.response?.data?.message || e.message || 'Erro ao carregar pedidos';
  } finally {
    loading.value = false;
  }
};
const debouncedLoadOrders = useDebounce(loadOrders, 350);

const loadSuppliers = async () => {
  try {
    const response = await fetch('http://localhost:3001/api/v1/suppliers', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
    });
    const data = await response.json();
    suppliers.value = data.data.data || [];
  } catch (error) {
    console.error('Erro ao carregar fornecedores:', error);
  }
};

const loadProducts = async () => {
  try {
    const response = await fetch('http://localhost:3001/api/v1/products', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
    });
    const data = await response.json();
    products.value = data.data.data || [];
  } catch (error) {
    console.error('Erro ao carregar produtos:', error);
  }
};

const addItem = () => {
  form.value.items.push({ productId: '', quantity: 0, unitPrice: 0 });
};

const removeItem = (index: number) => {
  form.value.items.splice(index, 1);
};

const handleSubmit = async () => {
  submitting.value = true;
  try {
    await orderStore.createOrder(form.value);
    showCreateModal.value = false;
    await loadOrders();
    toast.success('Pedido criado com sucesso!');
  } catch (error: any) {
    toast.error(error.message || 'Erro ao criar pedido');
  } finally {
    submitting.value = false;
  }
};

const viewOrder = async (order: PurchaseOrder) => {
  try {
    // Buscar detalhes completos do pedido
    const response = await orderStore.getOrderById(order.id);
    selectedOrder.value = response;
    showViewModal.value = true;
  } catch (error: any) {
    toast.error(error.message || 'Erro ao carregar detalhes do pedido');
  }
};

const confirmOrder = async (id: string) => {
  if (await confirmDialog('Confirmar este pedido?')) {
    try {
      await orderStore.confirmOrder(id);
      await loadOrders();
      toast.success('Pedido confirmado com sucesso!');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao confirmar pedido');
    }
  }
};

const cancelOrder = async (id: string) => {
  if (await confirmDialog('Cancelar este pedido?')) {
    try {
      await orderStore.cancelOrder(id);
      await loadOrders();
      toast.success('Pedido cancelado com sucesso!');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao cancelar pedido');
    }
  }
};

const printOrderPDF = (order: PurchaseOrder) => {
  try {
    const pdfData: Record<string, any> = {
      'Fornecedor': order.supplier?.name || '',
      'Data do Pedido': formatDatePDF(order.orderDate),
      'Data Esperada': formatDatePDF(order.expectedDate),
      'Status': getStatusLabel(order.status),
      'Condições de Pagamento': order.paymentTerms || 'Não informado',
      'Valor Total': formatCurrencyPDF(order.totalValue),
    };

    if (order.approvedBy) {
      pdfData['Aprovado por'] = order.approvedBy;
    }

    pdfData['Observações'] = order.notes || 'Nenhuma';

    const pdf = generatePDF({
      title: 'PEDIDO DE COMPRA',
      subtitle: order.orderNumber,
      data: pdfData,
      items: order.items?.map(item => ({
        produto: `${item.product?.code} - ${item.product?.name}`,
        quantidade: item.quantity,
        recebido: item.receivedQty || 0,
        unitario: formatCurrencyPDF(item.unitPrice),
        total: formatCurrencyPDF(item.totalPrice),
      })) || [],
      itemsColumns: [
        { header: 'Produto', key: 'produto', align: 'left' },
        { header: 'Quantidade', key: 'quantidade', align: 'right' },
        { header: 'Recebido', key: 'recebido', align: 'right' },
        { header: 'Preço Unit.', key: 'unitario', align: 'right' },
        { header: 'Total', key: 'total', align: 'right' },
      ],
      supplierSignature: true,
    });

    pdf.save(`Pedido_${order.orderNumber}.pdf`);
  } catch (error: any) {
    toast.error('Erro ao gerar PDF: ' + error.message);
  }
};

onMounted(() => {
  loadOrders();
  loadSuppliers();
  loadProducts();
});
</script>
