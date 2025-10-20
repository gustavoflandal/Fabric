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
      <div class="mb-6 flex justify-between items-center">
        <div>
          <h2 class="text-3xl font-bold text-gray-900">Pedidos de Compra</h2>
          <p class="mt-1 text-sm text-gray-600">
            Gerencie pedidos de compra
          </p>
        </div>
        <Button @click="showCreateModal = true">
          + Novo Pedido
        </Button>
      </div>

      <Card>
        <div class="mb-4 flex gap-4">
          <input
            v-model="filters.search"
            type="text"
            placeholder="Buscar..."
            class="flex-1 rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            @input="loadOrders"
          />
          <select v-model="filters.status" @change="loadOrders" class="rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500">
            <option value="">Todos os Status</option>
            <option value="PENDING">Pendente</option>
            <option value="CONFIRMED">Confirmado</option>
            <option value="PARTIAL">Parcial</option>
            <option value="RECEIVED">Recebido</option>
            <option value="CANCELLED">Cancelado</option>
          </select>
        </div>

        <div v-if="loading" class="text-center py-8">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <p class="mt-2 text-gray-600">Carregando...</p>
        </div>

        <div v-else-if="orders.length === 0" class="text-center py-8">
          <p class="text-gray-500">Nenhum pedido encontrado</p>
        </div>

        <div v-else class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Número</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fornecedor</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Previsão</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valor Total</th>
                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="order in orders" :key="order.id" class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {{ order.orderNumber }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {{ order.supplier?.name }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ formatDate(order.orderDate) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ formatDate(order.expectedDate) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span :class="getStatusClass(order.status)" class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full">
                    {{ getStatusLabel(order.status) }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {{ formatCurrency(order.totalValue) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <Button variant="outline" size="sm" @click="viewOrder(order)" class="mr-2">
                    Ver
                  </Button>
                  <Button v-if="order.status === 'PENDING'" variant="primary" size="sm" @click="confirmOrder(order.id)" class="mr-2">
                    Confirmar
                  </Button>
                  <Button v-if="order.status !== 'RECEIVED' && order.status !== 'CANCELLED'" variant="danger" size="sm" @click="cancelOrder(order.id)">
                    Cancelar
                  </Button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </main>

    <!-- Modal Criar -->
    <div v-if="showCreateModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div class="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-medium">Novo Pedido de Compra</h3>
          <button @click="showCreateModal = false" class="text-gray-400 hover:text-gray-500">
            <span class="text-2xl">&times;</span>
          </button>
        </div>
        
        <form @submit.prevent="handleSubmit">
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700">Fornecedor</label>
              <select v-model="form.supplierId" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500">
                <option value="">Selecione...</option>
                <option v-for="supplier in suppliers" :key="supplier.id" :value="supplier.id">
                  {{ supplier.name }}
                </option>
              </select>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700">Data de Entrega Prevista</label>
                <input v-model="form.expectedDate" type="date" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700">Forma de Pagamento</label>
                <input v-model="form.paymentMethod" type="text" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700">Frete (R$)</label>
                <input v-model.number="form.shippingCost" type="number" step="0.01" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700">Desconto (R$)</label>
                <input v-model.number="form.discount" type="number" step="0.01" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700">Observações</label>
              <textarea v-model="form.notes" rows="3" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"></textarea>
            </div>

            <div>
              <div class="flex justify-between items-center mb-2">
                <label class="block text-sm font-medium text-gray-700">Itens</label>
                <Button type="button" size="sm" @click="addItem">+ Adicionar Item</Button>
              </div>
              
              <div v-for="(item, index) in form.items" :key="index" class="flex gap-2 mb-2">
                <select v-model="item.productId" required class="flex-1 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500">
                  <option value="">Produto...</option>
                  <option v-for="product in products" :key="product.id" :value="product.id">
                    {{ product.code }} - {{ product.name }}
                  </option>
                </select>
                <input v-model.number="item.quantity" type="number" placeholder="Qtd" required class="w-24 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
                <input v-model.number="item.unitPrice" type="number" step="0.01" placeholder="Preço" required class="w-32 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
                <Button type="button" variant="danger" size="sm" @click="removeItem(index)">X</Button>
              </div>
            </div>
          </div>

          <div class="mt-6 flex justify-end gap-3">
            <Button type="button" variant="outline" @click="showCreateModal = false">
              Cancelar
            </Button>
            <Button type="submit" :disabled="submitting">
              {{ submitting ? 'Salvando...' : 'Salvar' }}
            </Button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import { usePurchaseOrderStore } from '@/stores/purchase-order.store';
import type { PurchaseOrder } from '@/services/purchase-order.service';
import Button from '@/components/common/Button.vue';
import Card from '@/components/common/Card.vue';

const router = useRouter();
const authStore = useAuthStore();
const orderStore = usePurchaseOrderStore();

const orders = ref<PurchaseOrder[]>([]);
const loading = ref(false);
const showCreateModal = ref(false);
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

const handleLogout = async () => {
  await authStore.logout();
  router.push('/login');
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('pt-BR');
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const getStatusClass = (status: string) => {
  const classes: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    CONFIRMED: 'bg-blue-100 text-blue-800',
    PARTIAL: 'bg-purple-100 text-purple-800',
    RECEIVED: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-red-100 text-red-800',
  };
  return classes[status] || 'bg-gray-100 text-gray-800';
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
  try {
    const response = await orderStore.fetchOrders(filters.value);
    orders.value = response.data;
  } catch (error: any) {
    alert(error.message || 'Erro ao carregar pedidos');
  } finally {
    loading.value = false;
  }
};

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
    alert('Pedido criado com sucesso!');
  } catch (error: any) {
    alert(error.message || 'Erro ao criar pedido');
  } finally {
    submitting.value = false;
  }
};

const viewOrder = (order: PurchaseOrder) => {
  alert(`Visualizar pedido ${order.orderNumber}`);
};

const confirmOrder = async (id: string) => {
  if (confirm('Confirmar este pedido?')) {
    try {
      await orderStore.confirmOrder(id);
      await loadOrders();
      alert('Pedido confirmado com sucesso!');
    } catch (error: any) {
      alert(error.message || 'Erro ao confirmar pedido');
    }
  }
};

const cancelOrder = async (id: string) => {
  if (confirm('Cancelar este pedido?')) {
    try {
      await orderStore.cancelOrder(id);
      await loadOrders();
      alert('Pedido cancelado com sucesso!');
    } catch (error: any) {
      alert(error.message || 'Erro ao cancelar pedido');
    }
  }
};

onMounted(() => {
  loadOrders();
  loadSuppliers();
  loadProducts();
});
</script>
