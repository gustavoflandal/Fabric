<template>
  <div class="min-h-screen bg-gray-50">
    <header class="bg-white shadow-sm border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
          <div class="flex items-center">
            <img src="/logo.png" alt="Fabric" class="h-10 w-auto" />
            <h1 class="ml-4 text-2xl font-bold text-primary-800">Fabric</h1>
          </div>
          
          <div class="flex items-center space-x-4">
            <RouterLink to="/dashboard" class="text-sm text-gray-700 hover:text-primary-600">
              Dashboard
            </RouterLink>
            <span class="text-sm text-gray-700">
              Olá, <span class="font-semibold">{{ authStore.userName }}</span>
            </span>
            <Button variant="outline" size="sm" @click="handleLogout">
              Sair
            </Button>
          </div>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Page Header -->
      <div class="mb-6 flex justify-between items-center">
        <div>
          <h2 class="text-3xl font-bold text-gray-900">Ordens de Produção</h2>
          <p class="mt-1 text-sm text-gray-600">
            Gerencie as ordens de produção
          </p>
        </div>
        <Button variant="primary" @click="openCreateModal">
          + Nova Ordem
        </Button>
      </div>

      <Card>
        <div class="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="md:col-span-2">
            <label class="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
            <input
              v-model="filters.search"
              type="text"
              placeholder="Número ou produto..."
              class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              @input="handleSearch"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select v-model="filters.status" @change="handleSearch" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500">
              <option value="">Todos</option>
              <option value="PLANNED">Planejada</option>
              <option value="RELEASED">Liberada</option>
              <option value="IN_PROGRESS">Em Progresso</option>
              <option value="COMPLETED">Concluída</option>
              <option value="CANCELLED">Cancelada</option>
            </select>
          </div>
        </div>

        <div v-if="loading" class="text-center py-12">
          <p class="text-gray-500">Carregando...</p>
        </div>

        <div v-else-if="orders.length === 0" class="text-center py-12">
          <p class="text-gray-500">Nenhuma ordem de produção encontrada</p>
          <Button @click="openCreateModal" class="mt-4">Criar Primeira Ordem</Button>
        </div>

        <div v-else class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Número</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produto</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantidade</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progresso</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Início</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fim</th>
                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="order in orders" :key="order.id" class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ order.orderNumber }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {{ order.product?.code }} - {{ order.product?.name }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ order.quantity }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ order.producedQty }} / {{ order.quantity }}
                  <span class="text-xs text-gray-400">({{ Math.round((order.producedQty / order.quantity) * 100) }}%)</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span :class="getStatusClass(order.status)" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium">
                    {{ getStatusLabel(order.status) }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ formatDate(order.scheduledStart) }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ formatDate(order.scheduledEnd) }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                  <button @click="openDetailsModal(order)" class="text-primary-600 hover:text-primary-900">Detalhes</button>
                  <button @click="handleDelete(order)" class="text-red-600 hover:text-red-900">Excluir</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </main>

    <!-- Modal de Criação -->
    <div v-if="showModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" @click="closeModal">
      <div class="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto" @click.stop>
        <div class="p-6">
          <div class="flex justify-between items-start mb-6">
            <h3 class="text-2xl font-bold text-gray-900">Nova Ordem de Produção</h3>
            <button @click="closeModal" class="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
          </div>
          <form @submit.prevent="handleSubmit" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Número da Ordem *</label>
              <input v-model="formData.orderNumber" type="text" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Produto *</label>
              <select v-model="formData.productId" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500">
                <option value="">Selecione um produto...</option>
                <option v-for="product in products" :key="product.id" :value="product.id">
                  {{ product.code }} - {{ product.name }}
                </option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Quantidade *</label>
              <input v-model.number="formData.quantity" type="number" min="0.01" step="0.01" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Início Agendado *</label>
                <input v-model="formData.scheduledStart" type="datetime-local" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Fim Agendado *</label>
                <input v-model="formData.scheduledEnd" type="datetime-local" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Prioridade</label>
              <select v-model.number="formData.priority" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500">
                <option :value="1">1 - Muito Baixa</option>
                <option :value="3">3 - Baixa</option>
                <option :value="5">5 - Normal</option>
                <option :value="7">7 - Alta</option>
                <option :value="10">10 - Urgente</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Observações</label>
              <textarea v-model="formData.notes" rows="3" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"></textarea>
            </div>
            <div class="flex gap-3 pt-4">
              <Button type="button" variant="outline" @click="closeModal" class="flex-1">Cancelar</Button>
              <Button type="submit" :disabled="loading" class="flex-1">Criar Ordem</Button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- Modal de Detalhes -->
    <ProductionOrderDetailsModal
      v-model="showDetailsModal"
      :order="selectedOrder"
      @refresh="loadOrders"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import { useProductionOrderStore } from '@/stores/production-order.store';
import { useProductStore } from '@/stores/product.store';
import type { ProductionOrder } from '@/services/production-order.service';
import Button from '@/components/common/Button.vue';
import Card from '@/components/common/Card.vue';
import ProductionOrderDetailsModal from '@/components/production/ProductionOrderDetailsModal.vue';

const router = useRouter();
const authStore = useAuthStore();
const orderStore = useProductionOrderStore();
const productStore = useProductStore();

const orders = ref<ProductionOrder[]>([]);
const products = ref<any[]>([]);
const loading = ref(false);
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
  try {
    const result = await orderStore.fetchOrders(filters.value);
    orders.value = result.data;
  } catch (error) {
    console.error('Erro ao carregar ordens:', error);
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
    alert('Ordem de produção criada com sucesso!');
    closeModal();
    await loadOrders();
  } catch (error: any) {
    alert(error.response?.data?.message || 'Erro ao criar ordem de produção');
  }
};

const openDetailsModal = (order: ProductionOrder) => {
  selectedOrder.value = order;
  showDetailsModal.value = true;
};

const handleLogout = async () => {
  await authStore.logout();
  router.push('/login');
};

const handleDelete = async (order: ProductionOrder) => {
  if (!confirm(`Deseja realmente excluir a ordem ${order.orderNumber}?`)) return;

  try {
    await orderStore.deleteOrder(order.id);
    alert('Ordem excluída com sucesso!');
    await loadOrders();
  } catch (error: any) {
    alert(error.response?.data?.message || 'Erro ao excluir ordem');
  }
};

const goBack = () => {
  router.push('/dashboard');
};

const getStatusClass = (status: string) => {
  const classes: Record<string, string> = {
    PLANNED: 'bg-blue-100 text-blue-800',
    RELEASED: 'bg-purple-100 text-purple-800',
    IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
    COMPLETED: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-red-100 text-red-800',
  };
  return classes[status] || 'bg-gray-100 text-gray-800';
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

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('pt-BR');
};
</script>
