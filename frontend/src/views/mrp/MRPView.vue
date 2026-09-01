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
          <h2 class="text-3xl font-bold text-gray-900">MRP - Planejamento de Materiais</h2>
          <p class="mt-1 text-sm text-gray-600">
            Cálculo de necessidades de materiais
          </p>
        </div>
        <Button @click="handleExecuteAll" :disabled="loading">
          🔄 Executar MRP Completo
        </Button>
      </div>

      <!-- Summary Cards -->
      <div v-if="summary" class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card>
          <div class="text-center">
            <div class="text-3xl mb-2">📋</div>
            <p class="text-2xl font-bold text-gray-900">{{ summary.totalOrders }}</p>
            <p class="text-sm text-gray-600">Ordens Pendentes</p>
          </div>
        </Card>
        <Card>
          <div class="text-center">
            <div class="text-3xl mb-2">📦</div>
            <p class="text-2xl font-bold text-gray-900">{{ summary.totalRequirements }}</p>
            <p class="text-sm text-gray-600">Itens Necessários</p>
          </div>
        </Card>
        <Card>
          <div class="text-center">
            <div class="text-3xl mb-2">🛒</div>
            <p class="text-2xl font-bold text-primary-600">{{ summary.totalToBuy }}</p>
            <p class="text-sm text-gray-600">Itens para Comprar</p>
          </div>
        </Card>
        <Card>
          <div class="text-center">
            <div class="text-3xl mb-2">🏭</div>
            <p class="text-2xl font-bold text-success-600">{{ summary.totalToProduce }}</p>
            <p class="text-sm text-gray-600">Itens para Produzir</p>
          </div>
        </Card>
      </div>

      <!-- Tabs -->
      <div class="mb-6">
        <div class="border-b border-gray-200">
          <nav class="-mb-px flex space-x-8">
            <button
              @click="activeTab = 'suggestions'"
              :class="[
                'py-4 px-1 border-b-2 font-medium text-sm',
                activeTab === 'suggestions'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              ]"
            >
              Sugestões
            </button>
            <button
              @click="activeTab = 'results'"
              :class="[
                'py-4 px-1 border-b-2 font-medium text-sm',
                activeTab === 'results'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              ]"
            >
              Resultados Detalhados
            </button>
          </nav>
        </div>
      </div>

      <!-- Sugestões Tab -->
      <div v-if="activeTab === 'suggestions'">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Sugestões de Compra -->
          <Card title="Sugestões de Compra">
            <div v-if="purchaseSuggestions.length === 0" class="text-center py-8 text-gray-500">
              Nenhuma sugestão de compra no momento
            </div>
            <div v-else class="space-y-3">
              <div
                v-for="suggestion in purchaseSuggestions"
                :key="suggestion.product.id"
                class="p-4 border border-gray-200 rounded-lg"
              >
                <div class="flex justify-between items-start mb-2">
                  <div>
                    <p class="font-semibold text-gray-900">{{ suggestion.product.code }}</p>
                    <p class="text-sm text-gray-600">{{ suggestion.product.name }}</p>
                  </div>
                  <span
                    :class="[
                      'px-2 py-1 text-xs font-semibold rounded',
                      suggestion.priority === 'HIGH'
                        ? 'bg-red-100 text-red-800'
                        : suggestion.priority === 'MEDIUM'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-green-100 text-green-800'
                    ]"
                  >
                    {{ suggestion.priority }}
                  </span>
                </div>
                <div class="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span class="text-gray-600">Quantidade:</span>
                    <span class="ml-1 font-semibold">{{ suggestion.quantity }}</span>
                  </div>
                  <div>
                    <span class="text-gray-600">Lead Time:</span>
                    <span class="ml-1 font-semibold">{{ suggestion.leadTime }} dias</span>
                  </div>
                  <div class="col-span-2">
                    <span class="text-gray-600">Data Sugerida:</span>
                    <span class="ml-1 font-semibold">{{ formatDate(suggestion.suggestedDate) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <!-- Sugestões de Produção -->
          <Card title="Sugestões de Produção">
            <div v-if="productionSuggestions.length === 0" class="text-center py-8 text-gray-500">
              Nenhuma sugestão de produção no momento
            </div>
            <div v-else class="space-y-3">
              <div
                v-for="suggestion in productionSuggestions"
                :key="suggestion.product.id"
                class="p-4 border border-gray-200 rounded-lg"
              >
                <div class="flex justify-between items-start mb-2">
                  <div>
                    <p class="font-semibold text-gray-900">{{ suggestion.product.code }}</p>
                    <p class="text-sm text-gray-600">{{ suggestion.product.name }}</p>
                  </div>
                  <span
                    :class="[
                      'px-2 py-1 text-xs font-semibold rounded',
                      suggestion.priority === 'HIGH'
                        ? 'bg-red-100 text-red-800'
                        : suggestion.priority === 'MEDIUM'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-green-100 text-green-800'
                    ]"
                  >
                    {{ suggestion.priority }}
                  </span>
                </div>
                <div class="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span class="text-gray-600">Quantidade:</span>
                    <span class="ml-1 font-semibold">{{ suggestion.quantity }}</span>
                  </div>
                  <div>
                    <span class="text-gray-600">Lead Time:</span>
                    <span class="ml-1 font-semibold">{{ suggestion.leadTime }} dias</span>
                  </div>
                  <div class="col-span-2">
                    <span class="text-gray-600">Data Sugerida:</span>
                    <span class="ml-1 font-semibold">{{ formatDate(suggestion.suggestedDate) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <!-- Resultados Tab -->
      <div v-if="activeTab === 'results'">
        <Card>
          <div v-if="results.length === 0" class="text-center py-12 text-gray-500">
            Execute o MRP para ver os resultados detalhados
          </div>
          <div v-else class="space-y-6">
            <div
              v-for="result in results"
              :key="result.orderId"
              class="border border-gray-200 rounded-lg p-4"
            >
              <div class="flex justify-between items-start mb-4">
                <div>
                  <h3 class="text-lg font-bold text-gray-900">{{ result.orderNumber }}</h3>
                  <p class="text-sm text-gray-600">
                    {{ result.totalItems }} itens | 
                    {{ result.itemsToBuy }} para comprar | 
                    {{ result.itemsToProduce }} para produzir
                  </p>
                </div>
                <span class="text-xs text-gray-500">
                  {{ formatDateTime(result.executedAt) }}
                </span>
              </div>

              <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Produto</th>
                      <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Necessário</th>
                      <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Disponível</th>
                      <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Em Pedido</th>
                      <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Necessidade Líquida</th>
                      <th class="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Ação</th>
                    </tr>
                  </thead>
                  <tbody class="bg-white divide-y divide-gray-200">
                    <tr v-for="req in result.requirements" :key="req.productId">
                      <td class="px-4 py-2">
                        <div class="text-sm font-medium text-gray-900">{{ req.product.code }}</div>
                        <div class="text-xs text-gray-500">{{ req.product.name }}</div>
                      </td>
                      <td class="px-4 py-2 text-right text-sm text-gray-900">{{ req.requiredQty.toFixed(2) }}</td>
                      <td class="px-4 py-2 text-right text-sm text-gray-900">{{ req.availableQty.toFixed(2) }}</td>
                      <td class="px-4 py-2 text-right text-sm text-gray-900">{{ req.onOrderQty.toFixed(2) }}</td>
                      <td class="px-4 py-2 text-right text-sm font-semibold text-gray-900">
                        {{ req.netRequirement.toFixed(2) }}
                      </td>
                      <td class="px-4 py-2 text-center">
                        <span
                          :class="[
                            'px-2 py-1 text-xs font-semibold rounded',
                            req.suggestedAction === 'BUY'
                              ? 'bg-blue-100 text-blue-800'
                              : req.suggestedAction === 'PRODUCE'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          ]"
                        >
                          {{ req.suggestedAction === 'BUY' ? 'Comprar' : req.suggestedAction === 'PRODUCE' ? 'Produzir' : 'OK' }}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import { useMRPStore } from '@/stores/mrp.store';
import Button from '@/components/common/Button.vue';
import Card from '@/components/common/Card.vue';

const router = useRouter();
const authStore = useAuthStore();
const mrpStore = useMRPStore();

const activeTab = ref<'suggestions' | 'results'>('suggestions');
const loading = ref(false);

const summary = ref(mrpStore.summary);
const results = ref(mrpStore.results);
const purchaseSuggestions = ref(mrpStore.purchaseSuggestions);
const productionSuggestions = ref(mrpStore.productionSuggestions);

onMounted(async () => {
  await loadData();
});

async function loadData() {
  loading.value = true;
  try {
    await Promise.all([
      mrpStore.fetchSummary(),
      mrpStore.fetchPurchaseSuggestions(),
      mrpStore.fetchProductionSuggestions(),
    ]);
    summary.value = mrpStore.summary;
    purchaseSuggestions.value = mrpStore.purchaseSuggestions;
    productionSuggestions.value = mrpStore.productionSuggestions;
  } catch (error) {
    console.error('Erro ao carregar dados do MRP:', error);
  } finally {
    loading.value = false;
  }
}

async function handleExecuteAll() {
  loading.value = true;
  try {
    await mrpStore.executeForAllPending();
    results.value = mrpStore.results;
    activeTab.value = 'results';
    await loadData();
  } catch (error) {
    console.error('Erro ao executar MRP:', error);
  } finally {
    loading.value = false;
  }
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('pt-BR');
}

function formatDateTime(date: string) {
  return new Date(date).toLocaleString('pt-BR');
}

const handleLogout = async () => {
  await authStore.logout();
  router.push('/login');
};
</script>
