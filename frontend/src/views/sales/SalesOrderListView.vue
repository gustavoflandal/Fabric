<template>
  <AppLayout title="Pedidos de Venda" subtitle="Cadastro e ciclo de vida dos pedidos do módulo de Expedição">
    <template #actions>
      <Button @click="openCreateModal"><span class="mr-2">+</span>Novo Pedido</Button>
    </template>

    <Card class="mb-6">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormField id="so-filter-search" label="Buscar">
          <input
            v-model="filters.search"
            type="text"
            placeholder="Número do pedido, cliente..."
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            @input="debouncedFilterChange"
          />
        </FormField>
        <FormField id="so-filter-status" label="Status">
          <select
            v-model="filters.status"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            @change="handleFilterChange"
          >
            <option value="">Todos</option>
            <option v-for="status in SALES_ORDER_STATUSES" :key="status" :value="status">
              {{ SALES_ORDER_STATUS_LABELS[status] }}
            </option>
          </select>
        </FormField>
        <FormField id="so-filter-customer" label="Cliente">
          <select
            v-model="filters.customerId"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            @change="handleFilterChange"
          >
            <option value="">Todos</option>
            <option v-for="customer in customers" :key="customer.id" :value="customer.id">
              {{ customer.code }} - {{ customer.name }}
            </option>
          </select>
        </FormField>
      </div>
    </Card>

    <DataTable
      :loading="loading"
      :error="error"
      :items="orders"
      :pagination="pagination"
      empty-title="Nenhum pedido de venda encontrado"
      empty-hint="Ajuste os filtros ou cadastre um novo pedido."
      @retry="loadOrders"
      @change-page="changePage"
    >
      <template #empty-action>
        <Button @click="openCreateModal"><span class="mr-2">+</span>Novo Pedido</Button>
      </template>

      <template #head>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Número</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Armazém</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Itens</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valor Total</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
        <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
      </template>

      <template #row="{ item }">
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ item.orderNumber }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{{ item.customer?.name ?? '—' }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ item.warehouse?.name ?? '—' }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ formatDate(item.orderDate) }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ item.items?.length ?? 0 }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ formatCurrency(item.totalValue) }}</td>
        <td class="px-6 py-4 whitespace-nowrap">
          <StatusBadge :label="SALES_ORDER_STATUS_LABELS[item.status]" :tone="statusTone(item.status)" />
        </td>
        <!--
          Sem gate de PERMISSÃO por botão (convenção do projeto: RBAC é do
          backend). Os `v-if` abaixo são de ESTADO — a ação simplesmente não
          existe naquele status, e o backend a recusaria com 400.
        -->
        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
          <button
            v-if="item.status === 'DRAFT'"
            @click="openEditModal(item)"
            class="text-primary-600 hover:text-primary-900"
          >
            Editar
          </button>
          <button
            v-if="item.status === 'DRAFT'"
            @click="handleConfirm(item)"
            class="text-green-600 hover:text-green-900"
          >
            Confirmar
          </button>
          <button
            v-if="canCancel(item)"
            @click="handleCancel(item)"
            class="text-red-600 hover:text-red-900"
          >
            Cancelar
          </button>
          <RouterLink
            :to="{ path: '/shipments', query: { salesOrderId: item.id } }"
            class="text-gray-600 hover:text-gray-900"
          >
            Romaneios
          </RouterLink>
        </td>
      </template>
    </DataTable>

    <!-- Formulário do pedido: só faz sentido em DRAFT (o backend recusa editar
         qualquer outro status), então a edição só é aberta a partir daquele. -->
    <AppModal
      v-model="showModal"
      size="lg"
      :title="editingOrder ? `Editar Pedido - ${editingOrder.orderNumber}` : 'Novo Pedido de Venda'"
      @close="closeModal"
    >
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField id="so-form-customer" label="Cliente" required>
            <select
              v-model="form.customerId"
              required
              class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            >
              <option value="">Selecione...</option>
              <option v-for="customer in customers" :key="customer.id" :value="customer.id">
                {{ customer.code }} - {{ customer.name }}
              </option>
            </select>
          </FormField>
          <FormField id="so-form-warehouse" label="Armazém" required hint="De onde a mercadoria sai">
            <select
              v-model="form.warehouseId"
              required
              class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            >
              <option value="">Selecione...</option>
              <option v-for="warehouse in warehouses" :key="warehouse.id" :value="warehouse.id">
                {{ warehouse.code }} - {{ warehouse.name }}
              </option>
            </select>
          </FormField>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField id="so-form-expected" label="Data Prevista de Expedição">
            <input
              v-model="form.expectedShipDate"
              type="date"
              class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            />
          </FormField>
          <FormField id="so-form-notes" label="Observações" hint="Até 500 caracteres">
            <input
              v-model="form.notes"
              type="text"
              maxlength="500"
              class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            />
          </FormField>
        </div>

        <div>
          <div class="flex items-center justify-between mb-2">
            <h4 class="text-sm font-semibold text-gray-800">Itens do Pedido</h4>
            <Button type="button" variant="outline" size="sm" @click="addItem">+ Adicionar Item</Button>
          </div>

          <p v-if="form.items.length === 0" class="text-sm text-gray-500 py-3">
            O pedido precisa de pelo menos um item.
          </p>

          <div
            v-for="(item, index) in form.items"
            :key="index"
            class="grid grid-cols-1 md:grid-cols-12 gap-3 items-end border-b border-gray-100 pb-3 mb-3"
          >
            <div class="md:col-span-6">
              <FormField :id="`so-form-item-product-${index}`" label="Produto" required>
                <select
                  v-model="item.productId"
                  required
                  class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                >
                  <option value="">Selecione...</option>
                  <option v-for="product in products" :key="product.id" :value="product.id">
                    {{ product.code }} - {{ product.name }}
                  </option>
                </select>
              </FormField>
            </div>
            <div class="md:col-span-2">
              <FormField :id="`so-form-item-quantity-${index}`" label="Quantidade" required>
                <input
                  v-model.number="item.quantity"
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                />
              </FormField>
            </div>
            <div class="md:col-span-2">
              <FormField :id="`so-form-item-price-${index}`" label="Preço Unit." required>
                <input
                  v-model.number="item.unitPrice"
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                />
              </FormField>
            </div>
            <div class="md:col-span-2 flex items-center justify-between gap-2">
              <span class="text-sm text-gray-600 whitespace-nowrap">
                {{ formatCurrency(lineTotal(item)) }}
              </span>
              <button
                type="button"
                class="text-red-600 hover:text-red-900 text-sm"
                @click="removeItem(index)"
              >
                Remover
              </button>
            </div>
          </div>

          <!-- Prévia do total. O valor gravado é o que o BACKEND calcula
               (`computeTotals`); isto aqui é só conferência visual. -->
          <p class="text-right text-sm font-semibold text-gray-800">
            Total: {{ formatCurrency(formTotal) }}
          </p>
        </div>

        <div class="flex gap-3 pt-4">
          <Button type="button" variant="outline" @click="closeModal" class="flex-1">Cancelar</Button>
          <Button type="submit" :disabled="saving || form.items.length === 0" class="flex-1">
            {{ saving ? 'Salvando...' : 'Salvar' }}
          </Button>
        </div>
      </form>
    </AppModal>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import AppLayout from '@/components/common/AppLayout.vue';
import AppModal from '@/components/common/AppModal.vue';
import Button from '@/components/common/Button.vue';
import Card from '@/components/common/Card.vue';
import DataTable from '@/components/common/DataTable.vue';
import type { Pagination } from '@/components/common/DataTable.vue';
import FormField from '@/components/common/FormField.vue';
import StatusBadge, { type BadgeTone } from '@/components/common/StatusBadge.vue';
import { useDebounce } from '@/composables/useDebounce';
import { confirmDialog } from '@/composables/useConfirm';
import { useToast } from '@/composables/useToast';
import { useCustomerStore } from '@/stores/customer.store';
import { useProductStore } from '@/stores/product.store';
import { useSalesOrderStore } from '@/stores/sales-order.store';
import { useWarehouseStore } from '@/stores/warehouse.store';
import type { Customer } from '@/services/customer.service';
import type { Product } from '@/services/product.service';
import {
  SALES_ORDER_STATUSES,
  SALES_ORDER_STATUS_LABELS,
  type SalesOrder,
  type SalesOrderItemInput,
  type SalesOrderStatus,
} from '@/types/sales.types';
import type { ApiError, Warehouse } from '@/types/warehouse.types';

const salesOrderStore = useSalesOrderStore();
const customerStore = useCustomerStore();
const productStore = useProductStore();
const warehouseStore = useWarehouseStore();
const toast = useToast();

const orders = ref<SalesOrder[]>([]);
const customers = ref<Customer[]>([]);
const products = ref<Product[]>([]);
const warehouses = ref<Warehouse[]>([]);

const loading = ref(false);
const error = ref('');
const saving = ref(false);

const filters = ref({ search: '', status: '', customerId: '' });
const pagination = ref<Pagination>({ page: 1, limit: 20, total: 0, pages: 0 });

const showModal = ref(false);
const editingOrder = ref<SalesOrder | null>(null);

interface OrderFormState {
  customerId: string;
  warehouseId: string;
  expectedShipDate: string;
  notes: string;
  items: SalesOrderItemInput[];
}

const emptyForm = (): OrderFormState => ({
  customerId: '',
  warehouseId: '',
  expectedShipDate: '',
  notes: '',
  items: [],
});

const form = ref<OrderFormState>(emptyForm());

const lineTotal = (item: SalesOrderItemInput) => (item.quantity || 0) * (item.unitPrice || 0);

const formTotal = computed(() =>
  form.value.items.reduce((sum, item) => sum + lineTotal(item), 0)
);

const STATUS_TONES: Record<SalesOrderStatus, BadgeTone> = {
  DRAFT: 'neutral',
  CONFIRMED: 'info',
  SEPARATING: 'warning',
  READY_TO_SHIP: 'info',
  SHIPPED: 'success',
  CANCELLED: 'danger',
};

const statusTone = (status: SalesOrderStatus): BadgeTone => STATUS_TONES[status] ?? 'neutral';

// O backend recusa cancelar SHIPPED (material já saiu) e CANCELLED (já está).
const canCancel = (order: SalesOrder) =>
  order.status !== 'SHIPPED' && order.status !== 'CANCELLED';

const loadOrders = async () => {
  loading.value = true;
  error.value = '';
  try {
    const result = await salesOrderStore.fetchOrders(
      pagination.value.page,
      pagination.value.limit,
      {
        search: filters.value.search || undefined,
        status: filters.value.status || undefined,
        customerId: filters.value.customerId || undefined,
      }
    );
    orders.value = result.items;
    pagination.value = result.pagination;
  } catch (e) {
    error.value = (e as ApiError).response?.data?.message || 'Erro ao carregar pedidos de venda';
  } finally {
    loading.value = false;
  }
};

const loadLookups = async () => {
  try {
    await Promise.all([
      customerStore.fetchCustomers(1, 1000, { active: true }),
      productStore.fetchProducts(1, 1000, { active: true }),
      warehouseStore.fetchWarehouses(),
    ]);
    customers.value = customerStore.customers;
    products.value = productStore.products;
    warehouses.value = warehouseStore.warehouses;
  } catch (e) {
    toast.error((e as ApiError).response?.data?.message || 'Erro ao carregar dados auxiliares');
  }
};

const handleFilterChange = () => {
  pagination.value.page = 1;
  loadOrders();
};
const debouncedFilterChange = useDebounce(handleFilterChange, 350);

const changePage = (page: number) => {
  pagination.value.page = page;
  loadOrders();
};

const openCreateModal = () => {
  editingOrder.value = null;
  form.value = emptyForm();
  addItem();
  showModal.value = true;
};

const openEditModal = (order: SalesOrder) => {
  editingOrder.value = order;
  form.value = {
    customerId: order.customerId,
    warehouseId: order.warehouseId,
    // `<input type="date">` só aceita YYYY-MM-DD; a API devolve ISO completo.
    expectedShipDate: order.expectedShipDate ? order.expectedShipDate.slice(0, 10) : '',
    notes: order.notes ?? '',
    items: (order.items ?? []).map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
  };
  showModal.value = true;
};

const closeModal = () => {
  showModal.value = false;
  editingOrder.value = null;
};

const addItem = () => {
  form.value.items.push({ productId: '', quantity: 1, unitPrice: 0 });
};

const removeItem = (index: number) => {
  form.value.items.splice(index, 1);
};

const handleSubmit = async () => {
  if (form.value.items.length === 0) {
    toast.error('O pedido deve ter pelo menos um item.');
    return;
  }

  const payload = {
    customerId: form.value.customerId,
    warehouseId: form.value.warehouseId,
    expectedShipDate: form.value.expectedShipDate || null,
    notes: form.value.notes || null,
    items: form.value.items.map((item) => ({
      productId: item.productId,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
    })),
  };

  saving.value = true;
  try {
    if (editingOrder.value) {
      await salesOrderStore.updateOrder(editingOrder.value.id, payload);
      toast.success('Pedido de venda atualizado com sucesso!');
    } else {
      await salesOrderStore.createOrder(payload);
      toast.success('Pedido de venda criado com sucesso!');
    }
    closeModal();
    await loadOrders();
  } catch (e) {
    toast.error((e as ApiError).response?.data?.message || 'Erro ao salvar pedido de venda');
  } finally {
    saving.value = false;
  }
};

const handleConfirm = async (order: SalesOrder) => {
  const confirmed = await confirmDialog(
    `Confirmar o pedido ${order.orderNumber}? Depois de confirmado ele não pode mais ser editado.`,
    { title: 'Confirmar pedido' }
  );
  if (!confirmed) return;

  try {
    await salesOrderStore.confirmOrder(order.id);
    toast.success('Pedido confirmado com sucesso!');
    await loadOrders();
  } catch (e) {
    toast.error((e as ApiError).response?.data?.message || 'Erro ao confirmar pedido de venda');
  }
};

const handleCancel = async (order: SalesOrder) => {
  const confirmed = await confirmDialog(
    `Cancelar o pedido ${order.orderNumber}? Os romaneios abertos e as tarefas de separação em aberto também serão cancelados.`,
    { title: 'Cancelar pedido' }
  );
  if (!confirmed) return;

  try {
    await salesOrderStore.cancelOrder(order.id);
    toast.success('Pedido cancelado com sucesso!');
    await loadOrders();
  } catch (e) {
    toast.error((e as ApiError).response?.data?.message || 'Erro ao cancelar pedido de venda');
  }
};

const formatDate = (date: string | null) =>
  date ? new Date(date).toLocaleDateString('pt-BR') : '—';

const formatCurrency = (value: number) =>
  (value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

onMounted(() => {
  loadOrders();
  loadLookups();
});
</script>
