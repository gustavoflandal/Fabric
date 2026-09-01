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
              Início
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
          <h2 class="text-3xl font-bold text-gray-900">Estoque</h2>
          <p class="mt-1 text-sm text-gray-600">
            Controle de saldos e movimentações
          </p>
        </div>
        <div class="flex space-x-2">
          <Button variant="outline" @click="showMovementModal = true">
            ⬆️ Entrada
          </Button>
          <Button variant="outline" @click="showExitModal = true">
            ⬇️ Saída
          </Button>
          <Button @click="showAdjustmentModal = true">
            🔧 Ajuste
          </Button>
        </div>
      </div>

      <!-- Summary Cards -->
      <div v-if="summary" class="grid grid-cols-1 md:grid-cols-5 gap-6 mb-6">
        <Card>
          <div class="text-center">
            <div class="text-3xl mb-2">📦</div>
            <p class="text-2xl font-bold text-gray-900">{{ summary.total }}</p>
            <p class="text-sm text-gray-600">Total de Produtos</p>
          </div>
        </Card>
        <Card>
          <div class="text-center">
            <div class="text-3xl mb-2">✅</div>
            <p class="text-2xl font-bold text-success-600">{{ summary.ok }}</p>
            <p class="text-sm text-gray-600">Estoque OK</p>
          </div>
        </Card>
        <Card>
          <div class="text-center">
            <div class="text-3xl mb-2">⚠️</div>
            <p class="text-2xl font-bold text-yellow-600">{{ summary.low }}</p>
            <p class="text-sm text-gray-600">Estoque Baixo</p>
          </div>
        </Card>
        <Card>
          <div class="text-center">
            <div class="text-3xl mb-2">🚨</div>
            <p class="text-2xl font-bold text-red-600">{{ summary.critical }}</p>
            <p class="text-sm text-gray-600">Estoque Crítico</p>
          </div>
        </Card>
        <Card>
          <div class="text-center">
            <div class="text-3xl mb-2">📈</div>
            <p class="text-2xl font-bold text-primary-600">{{ summary.excess }}</p>
            <p class="text-sm text-gray-600">Estoque Excesso</p>
          </div>
        </Card>
      </div>

      <!-- Filters -->
      <Card class="mb-6">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              v-model="filters.status"
              @change="loadBalances"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Todos</option>
              <option value="OK">OK</option>
              <option value="LOW">Baixo</option>
              <option value="CRITICAL">Crítico</option>
              <option value="EXCESS">Excesso</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select
              v-model="filters.type"
              @change="loadBalances"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Todos</option>
              <option value="RAW_MATERIAL">Matéria-Prima</option>
              <option value="SEMI_FINISHED">Semi-Acabado</option>
              <option value="FINISHED_PRODUCT">Produto Acabado</option>
            </select>
          </div>
          <div class="col-span-2 flex items-end">
            <Button @click="loadBalances" full-width>
              🔍 Filtrar
            </Button>
          </div>
        </div>
      </Card>

      <!-- Stock Table -->
      <Card>
        <div v-if="loading" class="text-center py-12">
          <div class="text-4xl mb-4">⏳</div>
          <p class="text-gray-600">Carregando...</p>
        </div>
        <div v-else-if="balances.length === 0" class="text-center py-12 text-gray-500">
          Nenhum produto encontrado
        </div>
        <div v-else class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Produto
                </th>
                <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quantidade
                </th>
                <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Mín / Máx
                </th>
                <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="balance in balances" :key="balance.productId">
                <td class="px-6 py-4">
                  <div class="text-sm font-medium text-gray-900">{{ balance.product.code }}</div>
                  <div class="text-xs text-gray-500">{{ balance.product.name }}</div>
                </td>
                <td class="px-6 py-4 text-center">
                  <span class="text-sm font-semibold text-gray-900">{{ balance.quantity }}</span>
                </td>
                <td class="px-6 py-4 text-center text-sm text-gray-600">
                  {{ balance.minStock }} / {{ balance.maxStock }}
                </td>
                <td class="px-6 py-4 text-center">
                  <span
                    :class="[
                      'px-2 py-1 text-xs font-semibold rounded',
                      balance.status === 'OK'
                        ? 'bg-green-100 text-green-800'
                        : balance.status === 'LOW'
                        ? 'bg-yellow-100 text-yellow-800'
                        : balance.status === 'CRITICAL'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-blue-100 text-blue-800'
                    ]"
                  >
                    {{ balance.status }}
                  </span>
                </td>
                <td class="px-6 py-4 text-center">
                  <button
                    @click="viewMovements(balance.productId)"
                    class="text-primary-600 hover:text-primary-900 text-sm font-medium"
                  >
                    Ver Movimentações
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <!-- Movement Modal -->
      <div
        v-if="showMovementModal"
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        @click="showMovementModal = false"
      >
        <div class="bg-white rounded-lg max-w-md w-full p-6" @click.stop>
          <h3 class="text-xl font-bold text-gray-900 mb-4">Registrar Entrada</h3>
          <form @submit.prevent="handleRegisterEntry">
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Produto</label>
                <input
                  v-model="movementForm.productId"
                  type="text"
                  required
                  placeholder="ID do Produto"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Quantidade</label>
                <input
                  v-model.number="movementForm.quantity"
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Motivo</label>
                <input
                  v-model="movementForm.reason"
                  type="text"
                  required
                  placeholder="Ex: Compra, Devolução"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Referência (opcional)</label>
                <input
                  v-model="movementForm.reference"
                  type="text"
                  placeholder="Ex: NF-12345"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <div class="mt-6 flex space-x-3">
              <Button type="button" variant="outline" @click="showMovementModal = false" full-width>
                Cancelar
              </Button>
              <Button type="submit" full-width>
                Registrar
              </Button>
            </div>
          </form>
        </div>
      </div>

      <!-- Exit Modal -->
      <div
        v-if="showExitModal"
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        @click="showExitModal = false"
      >
        <div class="bg-white rounded-lg max-w-md w-full p-6" @click.stop>
          <h3 class="text-xl font-bold text-gray-900 mb-4">Registrar Saída</h3>
          <form @submit.prevent="handleRegisterExit">
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Produto</label>
                <input
                  v-model="exitForm.productId"
                  type="text"
                  required
                  placeholder="ID do Produto"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Quantidade</label>
                <input
                  v-model.number="exitForm.quantity"
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Motivo</label>
                <input
                  v-model="exitForm.reason"
                  type="text"
                  required
                  placeholder="Ex: Produção, Venda"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Referência (opcional)</label>
                <input
                  v-model="exitForm.reference"
                  type="text"
                  placeholder="Ex: OP-2025-001"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <div class="mt-6 flex space-x-3">
              <Button type="button" variant="outline" @click="showExitModal = false" full-width>
                Cancelar
              </Button>
              <Button type="submit" full-width>
                Registrar
              </Button>
            </div>
          </form>
        </div>
      </div>

      <!-- Adjustment Modal -->
      <div
        v-if="showAdjustmentModal"
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        @click="showAdjustmentModal = false"
      >
        <div class="bg-white rounded-lg max-w-md w-full p-6" @click.stop>
          <h3 class="text-xl font-bold text-gray-900 mb-4">Registrar Ajuste</h3>
          <form @submit.prevent="handleRegisterAdjustment">
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Produto</label>
                <input
                  v-model="adjustmentForm.productId"
                  type="text"
                  required
                  placeholder="ID do Produto"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Quantidade (pode ser negativa)</label>
                <input
                  v-model.number="adjustmentForm.quantity"
                  type="number"
                  required
                  step="0.01"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Motivo</label>
                <input
                  v-model="adjustmentForm.reason"
                  type="text"
                  required
                  placeholder="Ex: Inventário, Correção"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <div class="mt-6 flex space-x-3">
              <Button type="button" variant="outline" @click="showAdjustmentModal = false" full-width>
                Cancelar
              </Button>
              <Button type="submit" full-width>
                Registrar
              </Button>
            </div>
          </form>
        </div>
      </div>

      <!-- Movements Modal -->
      <div
        v-if="showMovementsModal"
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        @click="showMovementsModal = false"
      >
        <div class="bg-white rounded-lg max-w-4xl w-full p-6 max-h-[80vh] overflow-y-auto" @click.stop>
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-xl font-bold text-gray-900">Movimentações do Produto</h3>
            <button @click="showMovementsModal = false" class="text-gray-400 hover:text-gray-600">
              <span class="text-2xl">×</span>
            </button>
          </div>

          <div v-if="loadingMovements" class="text-center py-8">
            <div class="text-4xl mb-4">⏳</div>
            <p class="text-gray-600">Carregando movimentações...</p>
          </div>

          <div v-else-if="movements.length === 0" class="text-center py-8 text-gray-500">
            <div class="text-4xl mb-4">📦</div>
            <p>Nenhuma movimentação registrada para este produto</p>
            <p class="text-sm mt-2">As movimentações aparecerão aqui quando forem registradas</p>
          </div>

          <div v-else>
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                    <th class="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Tipo</th>
                    <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Quantidade</th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Motivo</th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Referência</th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  <tr v-for="movement in movements" :key="movement.id">
                    <td class="px-4 py-2 text-sm text-gray-900">
                      {{ formatDateTime(movement.createdAt) }}
                    </td>
                    <td class="px-4 py-2 text-center">
                      <span
                        :class="[
                          'px-2 py-1 text-xs font-semibold rounded',
                          movement.type === 'IN'
                            ? 'bg-green-100 text-green-800'
                            : movement.type === 'OUT'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        ]"
                      >
                        {{ movement.type === 'IN' ? 'Entrada' : movement.type === 'OUT' ? 'Saída' : 'Ajuste' }}
                      </span>
                    </td>
                    <td class="px-4 py-2 text-right text-sm font-semibold"
                        :class="movement.type === 'IN' ? 'text-green-600' : 'text-red-600'">
                      {{ movement.type === 'IN' ? '+' : '-' }}{{ movement.quantity }}
                    </td>
                    <td class="px-4 py-2 text-sm text-gray-600">{{ movement.reason }}</td>
                    <td class="px-4 py-2 text-sm text-gray-500">{{ movement.reference || '-' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="mt-6">
            <Button @click="showMovementsModal = false" full-width>
              Fechar
            </Button>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import { useStockStore } from '@/stores/stock.store';
import Button from '@/components/common/Button.vue';
import Card from '@/components/common/Card.vue';

const router = useRouter();
const authStore = useAuthStore();
const stockStore = useStockStore();

const loading = ref(false);
const summary = ref(stockStore.summary);
const balances = ref(stockStore.balances);

const filters = ref({
  status: '',
  type: '',
});

const showMovementModal = ref(false);
const showExitModal = ref(false);
const showAdjustmentModal = ref(false);
const showMovementsModal = ref(false);
const loadingMovements = ref(false);
const movements = ref<any[]>([]);

const movementForm = ref({
  productId: '',
  quantity: 0,
  reason: '',
  reference: '',
});

const exitForm = ref({
  productId: '',
  quantity: 0,
  reason: '',
  reference: '',
});

const adjustmentForm = ref({
  productId: '',
  quantity: 0,
  reason: '',
});

onMounted(async () => {
  await loadData();
});

async function loadData() {
  loading.value = true;
  try {
    await Promise.all([
      stockStore.fetchSummary(),
      stockStore.fetchBalances(),
    ]);
    summary.value = stockStore.summary;
    balances.value = stockStore.balances;
  } catch (error) {
    console.error('Erro ao carregar dados do estoque:', error);
  } finally {
    loading.value = false;
  }
}

async function loadBalances() {
  loading.value = true;
  try {
    await stockStore.fetchBalances({
      status: filters.value.status as any,
      type: filters.value.type,
    });
    balances.value = stockStore.balances;
  } catch (error) {
    console.error('Erro ao filtrar saldos:', error);
  } finally {
    loading.value = false;
  }
}

async function handleRegisterEntry() {
  try {
    await stockStore.registerEntry(movementForm.value);
    showMovementModal.value = false;
    movementForm.value = { productId: '', quantity: 0, reason: '', reference: '' };
    await loadData();
    alert('Entrada registrada com sucesso!');
  } catch (error) {
    console.error('Erro ao registrar entrada:', error);
    alert('Erro ao registrar entrada');
  }
}

async function handleRegisterExit() {
  try {
    await stockStore.registerExit(exitForm.value);
    showExitModal.value = false;
    exitForm.value = { productId: '', quantity: 0, reason: '', reference: '' };
    await loadData();
    alert('Saída registrada com sucesso!');
  } catch (error) {
    console.error('Erro ao registrar saída:', error);
    alert('Erro ao registrar saída');
  }
}

async function handleRegisterAdjustment() {
  try {
    await stockStore.registerAdjustment(adjustmentForm.value);
    showAdjustmentModal.value = false;
    adjustmentForm.value = { productId: '', quantity: 0, reason: '' };
    await loadData();
    alert('Ajuste registrado com sucesso!');
  } catch (error) {
    console.error('Erro ao registrar ajuste:', error);
    alert('Erro ao registrar ajuste');
  }
}

async function viewMovements(productId: string) {
  showMovementsModal.value = true;
  loadingMovements.value = true;
  movements.value = [];
  
  try {
    await stockStore.fetchMovements(productId);
    movements.value = stockStore.movements;
  } catch (error) {
    console.error('Erro ao carregar movimentações:', error);
    alert('Erro ao carregar movimentações');
  } finally {
    loadingMovements.value = false;
  }
}

function formatDateTime(date: string) {
  return new Date(date).toLocaleString('pt-BR');
}

const handleLogout = async () => {
  await authStore.logout();
  router.push('/login');
};
</script>
