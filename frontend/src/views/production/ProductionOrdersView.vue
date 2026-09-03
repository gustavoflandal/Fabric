<template>
  <AppLayout title="Ordens de Produção" subtitle="Gerencie as ordens de produção">
    <template #actions>
      <Button variant="primary" @click="openCreateModal"><span class="mr-2">+</span>Nova Ordem</Button>
    </template>

    <Card class="mb-6">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormField id="po-filter-search" label="Buscar" class="md:col-span-2">
          <input
            v-model="filters.search"
            type="text"
            placeholder="Número ou produto..."
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            @input="debouncedSearch"
          />
        </FormField>
        <FormField id="po-filter-status" label="Status">
          <select
            v-model="filters.status"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            @change="handleSearch"
          >
            <option value="">Todos</option>
            <option value="PLANNED">Planejada</option>
            <option value="RELEASED">Liberada</option>
            <option value="IN_PROGRESS">Em Progresso</option>
            <option value="COMPLETED">Concluída</option>
            <option value="CANCELLED">Cancelada</option>
          </select>
        </FormField>
      </div>
    </Card>

    <DataTable
      :loading="loading"
      :error="error"
      :items="orders"
      empty-title="Nenhuma ordem de produção encontrada"
      empty-hint="Ajuste os filtros ou crie uma nova ordem de produção."
      @retry="loadOrders"
    >
      <template #empty-action>
        <Button @click="openCreateModal"><span class="mr-2">+</span>Nova Ordem</Button>
      </template>

      <template #head>
        <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Número</th>
        <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">Produto</th>
        <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Qtd.</th>
        <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Progresso</th>
        <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">Status</th>
        <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">Início</th>
        <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">Fim</th>
        <th scope="col" class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-40">Ações</th>
      </template>

      <template #row="{ item }">
        <td class="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ item.orderNumber }}</td>
        <td class="px-4 py-4 text-sm text-gray-900">
          <div class="font-medium">{{ item.product?.code }}</div>
          <div class="text-xs text-gray-500">{{ item.product?.name }}</div>
        </td>
        <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{{ item.quantity }}</td>
        <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
          <div>{{ item.producedQty }} / {{ item.quantity }}</div>
          <div class="text-xs text-gray-400">({{ progressPercent(item) }}%)</div>
        </td>
        <td class="px-4 py-4 whitespace-nowrap">
          <StatusBadge :label="getStatusLabel(item.status)" :tone="getStatusTone(item.status)" />
        </td>
        <td class="px-4 py-4 text-sm text-gray-500">{{ formatDate(item.scheduledStart) }}</td>
        <td class="px-4 py-4 text-sm text-gray-500">{{ formatDate(item.scheduledEnd) }}</td>
        <td class="px-4 py-4 text-right text-sm font-medium">
          <div class="flex items-center justify-end space-x-3">
            <button @click="openDetailsModal(item)" class="text-primary-600 hover:text-primary-900 whitespace-nowrap">Detalhes</button>
            <button @click="handleDelete(item)" class="text-red-600 hover:text-red-900 whitespace-nowrap">Excluir</button>
          </div>
        </td>
      </template>
    </DataTable>

    <!-- Modal de Criação — Esc/focus trap agora vêm do AppModal (§4.2). -->
    <AppModal v-model="showModal" title="Nova Ordem de Produção" @close="closeModal">
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <FormField id="po-form-order-number" label="Número da Ordem" required>
          <input v-model="formData.orderNumber" type="text" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
        </FormField>

        <FormField id="po-form-product" label="Produto" required>
          <select v-model="formData.productId" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500">
            <option value="">Selecione um produto...</option>
            <option v-for="product in products" :key="product.id" :value="product.id">
              {{ product.code }} - {{ product.name }}
            </option>
          </select>
        </FormField>

        <FormField id="po-form-quantity" label="Quantidade" required>
          <input v-model.number="formData.quantity" type="number" min="0.01" step="0.01" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
        </FormField>

        <!-- Programação — delimitação de seção do precedente de ProductsView (§5.2). -->
        <div class="border-t pt-4 mt-4 space-y-4">
          <h4 class="text-sm font-semibold text-gray-900">Programação</h4>

          <div class="grid grid-cols-2 gap-4">
            <FormField id="po-form-scheduled-start" label="Início Agendado" required>
              <input v-model="formData.scheduledStart" type="datetime-local" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
            </FormField>
            <FormField id="po-form-scheduled-end" label="Fim Agendado" required>
              <input v-model="formData.scheduledEnd" type="datetime-local" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
            </FormField>
          </div>

          <FormField id="po-form-priority" label="Prioridade">
            <select v-model.number="formData.priority" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500">
              <option :value="1">1 - Muito Baixa</option>
              <option :value="3">3 - Baixa</option>
              <option :value="5">5 - Normal</option>
              <option :value="7">7 - Alta</option>
              <option :value="10">10 - Urgente</option>
            </select>
          </FormField>
        </div>

        <FormField id="po-form-notes" label="Observações">
          <textarea v-model="formData.notes" rows="3" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"></textarea>
        </FormField>

        <div class="flex gap-3 pt-4">
          <Button type="button" variant="outline" @click="closeModal" class="flex-1">Cancelar</Button>
          <Button type="submit" :disabled="loading" class="flex-1">Criar Ordem</Button>
        </div>
      </form>
    </AppModal>

    <!-- Modal de Detalhes -->
    <ProductionOrderDetailsModal
      v-model="showDetailsModal"
      :order="selectedOrder"
      @refresh="loadOrders"
    />
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useProductionOrderStore } from '@/stores/production-order.store';
import { useProductStore } from '@/stores/product.store';
import type { ProductionOrder } from '@/services/production-order.service';
import AppLayout from '@/components/common/AppLayout.vue';
import AppModal from '@/components/common/AppModal.vue';
import Button from '@/components/common/Button.vue';
import Card from '@/components/common/Card.vue';
import DataTable from '@/components/common/DataTable.vue';
import FormField from '@/components/common/FormField.vue';
import StatusBadge, { type BadgeTone } from '@/components/common/StatusBadge.vue';
import ProductionOrderDetailsModal from '@/components/production/ProductionOrderDetailsModal.vue';
import { useToast } from '@/composables/useToast';
import { confirmDialog } from '@/composables/useConfirm';
import { useDebounce } from '@/composables/useDebounce';

const orderStore = useProductionOrderStore();
const productStore = useProductStore();
const toast = useToast();

const orders = ref<ProductionOrder[]>([]);
const products = ref<any[]>([]);
const loading = ref(false);
// §4.4-5 / I11: erro de carregamento e um estado proprio, nunca "lista vazia".
const error = ref('');
const showModal = ref(false);
const showDetailsModal = ref(false);
const selectedOrder = ref<ProductionOrder | null>(null);
const filters = ref({ search: '', status: '' });
const formData = ref({
  orderNumber: '',
  productId: '',
  quantity: 1,
  scheduledStart: '',
  scheduledEnd: '',
  priority: 5,
  notes: '',
});

onMounted(async () => {
  await loadOrders();
  await loadProducts();
});

const loadOrders = async () => {
  loading.value = true;
  error.value = '';
  try {
    const result = await orderStore.fetchOrders(filters.value);
    orders.value = result.data;
  } catch (e: any) {
    error.value = e.response?.data?.message || 'Erro ao carregar ordens de produção';
  } finally {
    loading.value = false;
  }
};

const loadProducts = async () => {
  try {
    const result = await productStore.fetchProducts({ type: 'FINISHED_GOOD', active: 'true' });
    products.value = result.data;
  } catch (error) {
    console.error('Erro ao carregar produtos:', error);
  }
};

const handleSearch = () => {
  loadOrders();
};
const debouncedSearch = useDebounce(handleSearch, 350);

const openCreateModal = () => {
  formData.value = {
    orderNumber: `OP-${Date.now()}`,
    productId: '',
    quantity: 1,
    scheduledStart: '',
    scheduledEnd: '',
    priority: 5,
    notes: '',
  };
  showModal.value = true;
};

const closeModal = () => {
  showModal.value = false;
};

const handleSubmit = async () => {
  try {
    await orderStore.createOrder(formData.value);
    toast.success('Ordem de produção criada com sucesso!');
    closeModal();
    await loadOrders();
  } catch (error: any) {
    toast.error(error.response?.data?.message || 'Erro ao criar ordem de produção');
  }
};

const openDetailsModal = (order: ProductionOrder) => {
  selectedOrder.value = order;
  showDetailsModal.value = true;
};

const handleDelete = async (order: ProductionOrder) => {
  if (!(await confirmDialog(`Deseja realmente excluir a ordem ${order.orderNumber}?`))) return;

  try {
    await orderStore.deleteOrder(order.id);
    toast.success('Ordem excluída com sucesso!');
    await loadOrders();
  } catch (error: any) {
    toast.error(error.response?.data?.message || 'Erro ao excluir ordem');
  }
};

// blue/purple do badge antigo normalizados para a paleta do StatusBadge (§4.2):
// PLANNED = neutral (ainda nao liberada), RELEASED = info, IN_PROGRESS = warning,
// COMPLETED = success, CANCELLED = danger.
const getStatusTone = (status: string): BadgeTone => {
  const tones: Record<string, BadgeTone> = {
    PLANNED: 'neutral',
    RELEASED: 'info',
    IN_PROGRESS: 'warning',
    COMPLETED: 'success',
    CANCELLED: 'danger',
  };
  return tones[status] || 'neutral';
};

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    PLANNED: 'Planejada',
    RELEASED: 'Liberada',
    IN_PROGRESS: 'Em Progresso',
    COMPLETED: 'Concluída',
    CANCELLED: 'Cancelada',
  };
  return labels[status] || status;
};

const progressPercent = (order: ProductionOrder) =>
  Math.round((order.producedQty / order.quantity) * 100);

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('pt-BR');
};
</script>
