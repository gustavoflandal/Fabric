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
      <div class="mb-6">
        <h2 class="text-3xl font-bold text-gray-900">Relatórios</h2>
        <p class="mt-1 text-sm text-gray-600">
          Análises e indicadores de produção
        </p>
      </div>

      <!-- Period Selector -->
      <Card class="mb-6">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Data Inicial</label>
            <input
              v-model="filters.startDate"
              type="date"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Data Final</label>
            <input
              v-model="filters.endDate"
              type="date"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div class="flex items-end">
            <Button @click="loadReports" :disabled="loading" full-width>
              📊 Gerar Relatórios
            </Button>
          </div>
        </div>
      </Card>

      <!-- Tabs -->
      <div class="mb-6">
        <div class="border-b border-gray-200">
          <nav class="-mb-px flex space-x-8">
            <button
              @click="activeTab = 'consolidated'"
              :class="[
                'py-4 px-1 border-b-2 font-medium text-sm',
                activeTab === 'consolidated'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              ]"
            >
              📊 Consolidado
            </button>
            <button
              @click="activeTab = 'production'"
              :class="[
                'py-4 px-1 border-b-2 font-medium text-sm',
                activeTab === 'production'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              ]"
            >
              🏭 Produção
            </button>
            <button
              @click="activeTab = 'efficiency'"
              :class="[
                'py-4 px-1 border-b-2 font-medium text-sm',
                activeTab === 'efficiency'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              ]"
            >
              ⚡ Eficiência
            </button>
            <button
              @click="activeTab = 'quality'"
              :class="[
                'py-4 px-1 border-b-2 font-medium text-sm',
                activeTab === 'quality'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              ]"
            >
              ✅ Qualidade
            </button>
          </nav>
        </div>
      </div>

      <!-- Empty State -->
      <Card v-if="!hasReports">
        <div class="text-center py-12 text-gray-500">
          <div class="text-6xl mb-4">📊</div>
          <p class="text-lg font-medium mb-2">Nenhum relatório gerado</p>
          <p class="text-sm">Selecione um período e clique em "Gerar Relatórios"</p>
        </div>
      </Card>

      <!-- Consolidated Report -->
      <div v-if="activeTab === 'consolidated' && consolidatedReport" class="space-y-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card title="📊 Resumo de Produção">
            <div class="space-y-3">
              <div class="flex justify-between py-2 border-b">
                <span class="text-gray-600">Total de Ordens:</span>
                <span class="font-bold text-lg">{{ consolidatedReport.production.total }}</span>
              </div>
              <div class="flex justify-between py-2 border-b">
                <span class="text-gray-600">Concluídas:</span>
                <span class="font-bold text-lg text-success-600">{{ consolidatedReport.production.completed }}</span>
              </div>
              <div class="flex justify-between py-2 border-b">
                <span class="text-gray-600">Em Andamento:</span>
                <span class="font-bold text-lg text-primary-600">{{ consolidatedReport.production.inProgress }}</span>
              </div>
              <div class="flex justify-between py-2">
                <span class="text-gray-600">Eficiência Geral:</span>
                <span class="font-bold text-xl text-primary-600">{{ consolidatedReport.production.efficiency?.toFixed(1) }}%</span>
              </div>
            </div>
          </Card>

          <Card title="⚡ Resumo de Eficiência">
            <div class="space-y-3">
              <div class="flex justify-between py-2 border-b">
                <span class="text-gray-600">Ordens Analisadas:</span>
                <span class="font-bold text-lg">{{ consolidatedReport.efficiency.totalOrders }}</span>
              </div>
              <div class="flex justify-between py-2 border-b">
                <span class="text-gray-600">Efic. Quantidade:</span>
                <span class="font-bold text-lg">{{ consolidatedReport.efficiency.avgQuantityEfficiency?.toFixed(1) }}%</span>
              </div>
              <div class="flex justify-between py-2 border-b">
                <span class="text-gray-600">Efic. Tempo:</span>
                <span class="font-bold text-lg">{{ consolidatedReport.efficiency.avgTimeEfficiency?.toFixed(1) }}%</span>
              </div>
              <div class="flex justify-between py-2">
                <span class="text-gray-600">Entregas no Prazo:</span>
                <span class="font-bold text-xl text-success-600">{{ consolidatedReport.efficiency.onTimeRate?.toFixed(1) }}%</span>
              </div>
            </div>
          </Card>

          <Card title="✅ Resumo de Qualidade">
            <div class="space-y-3">
              <div class="flex justify-between py-2 border-b">
                <span class="text-gray-600">Total Produzido:</span>
                <span class="font-bold text-lg text-success-600">{{ consolidatedReport.quality.totalProduced }}</span>
              </div>
              <div class="flex justify-between py-2 border-b">
                <span class="text-gray-600">Total Refugo:</span>
                <span class="font-bold text-lg text-red-600">{{ consolidatedReport.quality.totalScrap }}</span>
              </div>
              <div class="flex justify-between py-2 border-b">
                <span class="text-gray-600">Taxa de Refugo:</span>
                <span class="font-bold text-lg text-yellow-600">{{ consolidatedReport.quality.avgScrapRate?.toFixed(1) }}%</span>
              </div>
              <div class="flex justify-between py-2">
                <span class="text-gray-600">Taxa de Qualidade:</span>
                <span class="font-bold text-xl text-success-600">{{ consolidatedReport.quality.avgQualityRate?.toFixed(1) }}%</span>
              </div>
            </div>
          </Card>

          <Card title="⚙️ Centros de Trabalho">
            <div class="space-y-3">
              <div class="flex justify-between py-2 border-b">
                <span class="text-gray-600">Total de Centros:</span>
                <span class="font-bold text-lg">{{ consolidatedReport.workCenters }}</span>
              </div>
              <div class="flex justify-between py-2 border-b">
                <span class="text-gray-600">Período:</span>
                <span class="text-sm">{{ formatDate(consolidatedReport.period.start) }} - {{ formatDate(consolidatedReport.period.end) }}</span>
              </div>
              <div class="flex justify-between py-2">
                <span class="text-gray-600">Gerado em:</span>
                <span class="text-sm text-gray-500">{{ formatDateTime(consolidatedReport.generatedAt) }}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <!-- Production Report -->
      <div v-if="activeTab === 'production' && productionReport" class="space-y-6">
        <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <div class="text-center">
              <div class="text-3xl mb-2">📋</div>
              <p class="text-2xl font-bold text-gray-900">{{ productionReport.summary.total }}</p>
              <p class="text-xs text-gray-600">Total</p>
            </div>
          </Card>
          <Card>
            <div class="text-center">
              <div class="text-3xl mb-2">✅</div>
              <p class="text-2xl font-bold text-success-600">{{ productionReport.summary.completed }}</p>
              <p class="text-xs text-gray-600">Concluídas</p>
            </div>
          </Card>
          <Card>
            <div class="text-center">
              <div class="text-3xl mb-2">⚙️</div>
              <p class="text-2xl font-bold text-primary-600">{{ productionReport.summary.inProgress }}</p>
              <p class="text-xs text-gray-600">Em Andamento</p>
            </div>
          </Card>
          <Card>
            <div class="text-center">
              <div class="text-3xl mb-2">📈</div>
              <p class="text-2xl font-bold text-gray-900">{{ productionReport.summary.efficiency?.toFixed(1) }}%</p>
              <p class="text-xs text-gray-600">Eficiência</p>
            </div>
          </Card>
          <Card>
            <div class="text-center">
              <div class="text-3xl mb-2">⚠️</div>
              <p class="text-2xl font-bold text-yellow-600">{{ productionReport.summary.scrapRate?.toFixed(1) }}%</p>
              <p class="text-xs text-gray-600">Refugo</p>
            </div>
          </Card>
        </div>

        <Card title="Produção por Produto">
          <div v-if="productionReport.byProduct?.length > 0" class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Produto</th>
                  <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Ordens</th>
                  <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Planejado</th>
                  <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Produzido</th>
                  <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Refugo</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-for="item in productionReport.byProduct" :key="item.product?.code">
                  <td class="px-4 py-2">
                    <div class="text-sm font-medium text-gray-900">{{ item.product?.code }}</div>
                    <div class="text-xs text-gray-500">{{ item.product?.name }}</div>
                  </td>
                  <td class="px-4 py-2 text-right text-sm">{{ item.orders }}</td>
                  <td class="px-4 py-2 text-right text-sm">{{ item.planned }}</td>
                  <td class="px-4 py-2 text-right text-sm font-semibold">{{ item.produced }}</td>
                  <td class="px-4 py-2 text-right text-sm text-red-600">{{ item.scrap }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="text-center py-8 text-gray-500">
            Nenhum dado disponível
          </div>
        </Card>
      </div>

      <!-- Efficiency Report -->
      <div v-if="activeTab === 'efficiency' && efficiencyReport" class="space-y-6">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <div class="text-center">
              <div class="text-3xl mb-2">📋</div>
              <p class="text-2xl font-bold text-gray-900">{{ efficiencyReport.summary.totalOrders }}</p>
              <p class="text-xs text-gray-600">Ordens</p>
            </div>
          </Card>
          <Card>
            <div class="text-center">
              <div class="text-3xl mb-2">📊</div>
              <p class="text-2xl font-bold text-primary-600">{{ efficiencyReport.summary.avgQuantityEfficiency?.toFixed(1) }}%</p>
              <p class="text-xs text-gray-600">Efic. Qtd</p>
            </div>
          </Card>
          <Card>
            <div class="text-center">
              <div class="text-3xl mb-2">⏱️</div>
              <p class="text-2xl font-bold text-success-600">{{ efficiencyReport.summary.avgTimeEfficiency?.toFixed(1) }}%</p>
              <p class="text-xs text-gray-600">Efic. Tempo</p>
            </div>
          </Card>
          <Card>
            <div class="text-center">
              <div class="text-3xl mb-2">✅</div>
              <p class="text-2xl font-bold text-gray-900">{{ efficiencyReport.summary.onTimeRate?.toFixed(1) }}%</p>
              <p class="text-xs text-gray-600">No Prazo</p>
            </div>
          </Card>
        </div>

        <Card title="Detalhes de Eficiência">
          <div v-if="efficiencyReport.orders?.length > 0" class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ordem</th>
                  <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Planej.</th>
                  <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Produz.</th>
                  <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Efic. Qtd</th>
                  <th class="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Prazo</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-for="order in efficiencyReport.orders" :key="order.orderNumber">
                  <td class="px-4 py-2">
                    <div class="text-sm font-medium">{{ order.orderNumber }}</div>
                  </td>
                  <td class="px-4 py-2 text-right text-sm">{{ order.quantity }}</td>
                  <td class="px-4 py-2 text-right text-sm">{{ order.produced }}</td>
                  <td class="px-4 py-2 text-right text-sm font-semibold">{{ order.quantityEfficiency?.toFixed(1) }}%</td>
                  <td class="px-4 py-2 text-center">
                    <span :class="['px-2 py-1 text-xs font-semibold rounded', order.onTime ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800']">
                      {{ order.onTime ? 'Sim' : 'Não' }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="text-center py-8 text-gray-500">
            Nenhum dado disponível
          </div>
        </Card>
      </div>

      <!-- Quality Report -->
      <div v-if="activeTab === 'quality' && qualityReport" class="space-y-6">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <div class="text-center">
              <div class="text-3xl mb-2">📋</div>
              <p class="text-2xl font-bold text-gray-900">{{ qualityReport.summary.totalOrders }}</p>
              <p class="text-xs text-gray-600">Ordens</p>
            </div>
          </Card>
          <Card>
            <div class="text-center">
              <div class="text-3xl mb-2">✅</div>
              <p class="text-2xl font-bold text-success-600">{{ qualityReport.summary.totalProduced }}</p>
              <p class="text-xs text-gray-600">Produzido</p>
            </div>
          </Card>
          <Card>
            <div class="text-center">
              <div class="text-3xl mb-2">⚠️</div>
              <p class="text-2xl font-bold text-red-600">{{ qualityReport.summary.totalScrap }}</p>
              <p class="text-xs text-gray-600">Refugo</p>
            </div>
          </Card>
          <Card>
            <div class="text-center">
              <div class="text-3xl mb-2">📊</div>
              <p class="text-2xl font-bold text-primary-600">{{ qualityReport.summary.avgQualityRate?.toFixed(1) }}%</p>
              <p class="text-xs text-gray-600">Qualidade</p>
            </div>
          </Card>
        </div>

        <Card title="Qualidade por Produto">
          <div v-if="qualityReport.byProduct?.length > 0" class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Produto</th>
                  <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Produzido</th>
                  <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Refugo</th>
                  <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Taxa Refugo</th>
                  <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qualidade</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-for="item in qualityReport.byProduct" :key="item.product?.code">
                  <td class="px-4 py-2">
                    <div class="text-sm font-medium">{{ item.product?.code }}</div>
                  </td>
                  <td class="px-4 py-2 text-right text-sm">{{ item.produced }}</td>
                  <td class="px-4 py-2 text-right text-sm text-red-600">{{ item.scrap }}</td>
                  <td class="px-4 py-2 text-right text-sm font-semibold text-red-600">{{ item.scrapRate?.toFixed(1) }}%</td>
                  <td class="px-4 py-2 text-right text-sm font-semibold text-success-600">{{ item.qualityRate?.toFixed(1) }}%</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="text-center py-8 text-gray-500">
            Nenhum dado disponível
          </div>
        </Card>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import { useReportsStore } from '@/stores/reports.store';
import Button from '@/components/common/Button.vue';
import Card from '@/components/common/Card.vue';

const router = useRouter();
const authStore = useAuthStore();
const reportsStore = useReportsStore();

const activeTab = ref<'consolidated' | 'production' | 'efficiency' | 'quality'>('consolidated');
const loading = ref(false);

const filters = ref({
  startDate: new Date(new Date().setDate(1)).toISOString().split('T')[0],
  endDate: new Date().toISOString().split('T')[0],
});

const productionReport = computed(() => reportsStore.productionReport);
const efficiencyReport = computed(() => reportsStore.efficiencyReport);
const qualityReport = computed(() => reportsStore.qualityReport);
const consolidatedReport = computed(() => reportsStore.consolidatedReport);

const hasReports = computed(() => {
  return productionReport.value || efficiencyReport.value || 
         qualityReport.value || consolidatedReport.value;
});

async function loadReports() {
  if (!filters.value.startDate || !filters.value.endDate) {
    alert('Por favor, selecione o período');
    return;
  }

  loading.value = true;
  try {
    await Promise.all([
      reportsStore.fetchProductionReport(filters.value.startDate, filters.value.endDate),
      reportsStore.fetchEfficiencyReport(filters.value.startDate, filters.value.endDate),
      reportsStore.fetchQualityReport(filters.value.startDate, filters.value.endDate),
      reportsStore.fetchConsolidatedReport(filters.value.startDate, filters.value.endDate),
    ]);
  } catch (error) {
    console.error('Erro ao carregar relatórios:', error);
    alert('Erro ao carregar relatórios');
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
