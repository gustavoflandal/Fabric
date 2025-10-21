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
          <h2 class="text-3xl font-bold text-gray-900">Apontamentos de Produção</h2>
          <p class="mt-1 text-sm text-gray-600">
            Gerencie os apontamentos de produção
          </p>
        </div>
        <Button @click="showCreateModal = true">
          + Novo Apontamento
        </Button>
      </div>
      <Card>
        <div class="mb-4 flex gap-4">
          <input
            v-model="filters.search"
            type="text"
            placeholder="Buscar..."
            class="flex-1 rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            @input="loadPointings"
          />
          <select v-model="filters.status" @change="loadPointings" class="rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500">
            <option value="">Todos os Status</option>
            <option value="IN_PROGRESS">Em Progresso</option>
            <option value="COMPLETED">Concluído</option>
          </select>
        </div>

        <div v-if="loading" class="text-center py-12">
          <p class="text-gray-500">Carregando...</p>
        </div>

        <div v-else-if="pointings.length === 0" class="text-center py-12">
          <p class="text-gray-500">Nenhum apontamento encontrado</p>
          <Button @click="showCreateModal = true" class="mt-4">Criar Primeiro Apontamento</Button>
        </div>

        <div v-else class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-32">Ordem</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase min-w-[200px]">Operação</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-32">Operador</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-36">Início</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-36">Fim</th>
                <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase w-24">Qtd Boa</th>
                <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase w-24">Refugo</th>
                <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase w-28">Ações</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="pointing in pointings" :key="pointing.id" class="hover:bg-gray-50">
                <td class="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {{ pointing.productionOrder?.orderNumber }}
                </td>
                <td class="px-4 py-4 text-sm text-gray-900">
                  <div class="font-medium">Op {{ pointing.operation?.sequence }}</div>
                  <div class="text-xs text-gray-500">{{ pointing.operation?.description }}</div>
                </td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                  {{ pointing.user?.name }}
                </td>
                <td class="px-4 py-4 text-sm text-gray-500">
                  {{ formatDateTime(pointing.startTime) }}
                </td>
                <td class="px-4 py-4 text-sm text-gray-500">
                  {{ formatDateTime(pointing.endTime) }}
                </td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-right text-green-600 font-semibold">
                  {{ pointing.quantityGood }}
                </td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-right text-red-600">
                  {{ pointing.quantityScrap }}
                </td>
                <td class="px-4 py-4 text-right text-sm font-medium">
                  <button @click="handleDelete(pointing)" class="text-red-600 hover:text-red-900 whitespace-nowrap">Excluir</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </main>

    <!-- Modal de Criação -->
    <div v-if="showCreateModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" @click="showCreateModal = false">
      <div class="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto" @click.stop>
        <h3 class="text-xl font-bold text-gray-900 mb-4">Novo Apontamento de Produção</h3>
        
        <form @submit.prevent="handleCreate">
          <div class="space-y-4">
            <!-- Ordem de Produção -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Ordem de Produção *</label>
              <select
                v-model="form.productionOrderId"
                @change="loadOperations"
                required
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Selecione uma ordem</option>
                <option v-for="order in productionOrders" :key="order.id" :value="order.id">
                  {{ order.orderNumber }} - {{ order.product?.name }}
                </option>
              </select>
            </div>

            <!-- Operação -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Operação *</label>
              <select
                v-model="form.operationId"
                required
                :disabled="!form.productionOrderId"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100"
              >
                <option value="">Selecione uma operação</option>
                <option v-for="op in operations" :key="op.id" :value="op.id">
                  Op {{ op.sequence }} - {{ op.description }}
                </option>
              </select>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <!-- Data/Hora Início -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Início *</label>
                <input
                  v-model="form.startTime"
                  type="datetime-local"
                  required
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <!-- Data/Hora Fim -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Fim</label>
                <input
                  v-model="form.endTime"
                  type="datetime-local"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <!-- Quantidade Boa -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Quantidade Boa *</label>
                <input
                  v-model.number="form.quantityGood"
                  type="number"
                  min="0"
                  step="1"
                  required
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <!-- Quantidade Refugo -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Quantidade Refugo</label>
                <input
                  v-model.number="form.quantityScrap"
                  type="number"
                  min="0"
                  step="1"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <!-- Observações -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Observações</label>
              <textarea
                v-model="form.notes"
                rows="3"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Observações sobre o apontamento..."
              ></textarea>
            </div>
          </div>

          <div class="mt-6 flex space-x-3">
            <Button type="button" variant="outline" @click="closeModal" full-width>
              Cancelar
            </Button>
            <Button type="submit" :disabled="submitting" full-width>
              {{ submitting ? 'Salvando...' : 'Salvar Apontamento' }}
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
import { useProductionPointingStore } from '@/stores/production-pointing.store';
import type { ProductionPointing } from '@/services/production-pointing.service';
import Button from '@/components/common/Button.vue';
import Card from '@/components/common/Card.vue';

const router = useRouter();
const authStore = useAuthStore();
const pointingStore = useProductionPointingStore();

const pointings = ref<ProductionPointing[]>([]);
const loading = ref(false);
const showCreateModal = ref(false);
const submitting = ref(false);
const filters = ref({ search: '', status: '' });

const productionOrders = ref<any[]>([]);
const operations = ref<any[]>([]);

const form = ref({
  productionOrderId: '',
  operationId: '',
  startTime: '',
  endTime: '',
  quantityGood: 0,
  quantityScrap: 0,
  notes: '',
});

onMounted(async () => {
  await loadPointings();
  await loadProductionOrders();
});

const loadPointings = async () => {
  loading.value = true;
  try {
    const result = await pointingStore.fetchPointings(filters.value);
    pointings.value = result.data;
  } catch (error) {
    console.error('Erro ao carregar apontamentos:', error);
  } finally {
    loading.value = false;
  }
};

const handleDelete = async (pointing: ProductionPointing) => {
  if (!confirm('Deseja realmente excluir este apontamento?')) return;

  try {
    await pointingStore.deletePointing(pointing.id);
    alert('Apontamento excluído com sucesso!');
    await loadPointings();
  } catch (error: any) {
    alert(error.response?.data?.message || 'Erro ao excluir apontamento');
  }
};

const goBack = () => {
  router.push('/dashboard');
};

const handleLogout = async () => {
  await authStore.logout();
  router.push('/login');
};

const loadProductionOrders = async () => {
  try {
    // Buscar ordens em andamento ou planejadas
    const response = await fetch('http://localhost:3001/api/v1/production-orders?status=IN_PROGRESS,PLANNED', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
      }
    });
    const data = await response.json();
    productionOrders.value = data.data.data || [];
  } catch (error) {
    console.error('Erro ao carregar ordens:', error);
  }
};

const loadOperations = async () => {
  if (!form.value.productionOrderId) {
    operations.value = [];
    return;
  }

  try {
    // Buscar operações da ordem selecionada
    const response = await fetch(`http://localhost:3001/api/v1/production-orders/${form.value.productionOrderId}/operations`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
      }
    });
    const data = await response.json();
    operations.value = data.data || [];
  } catch (error) {
    console.error('Erro ao carregar operações:', error);
    operations.value = [];
  }
};

const handleCreate = async () => {
  submitting.value = true;
  try {
    await pointingStore.createPointing({
      productionOrderId: form.value.productionOrderId,
      operationId: form.value.operationId,
      startTime: new Date(form.value.startTime).toISOString(),
      endTime: form.value.endTime ? new Date(form.value.endTime).toISOString() : undefined,
      quantityGood: form.value.quantityGood,
      quantityScrap: form.value.quantityScrap || 0,
      notes: form.value.notes || undefined,
    });
    
    alert('Apontamento criado com sucesso!');
    closeModal();
    await loadPointings();
  } catch (error: any) {
    alert(error.response?.data?.message || 'Erro ao criar apontamento');
  } finally {
    submitting.value = false;
  }
};

const closeModal = () => {
  showCreateModal.value = false;
  form.value = {
    productionOrderId: '',
    operationId: '',
    startTime: '',
    endTime: '',
    quantityGood: 0,
    quantityScrap: 0,
    notes: '',
  };
  operations.value = [];
};

const formatDateTime = (dateString: string) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};
</script>
