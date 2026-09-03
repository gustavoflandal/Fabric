<template>
  <AppLayout title="Relatórios" subtitle="Análises e indicadores de produção">
    <!-- Seletor de período -->
    <Card class="mb-6">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormField id="reports-filter-start-date" label="Data Inicial">
          <input
            v-model="filters.startDate"
            type="date"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
          />
        </FormField>
        <FormField id="reports-filter-end-date" label="Data Final">
          <input
            v-model="filters.endDate"
            type="date"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
          />
        </FormField>
        <div class="flex items-end">
          <Button :disabled="loading" full-width @click="loadReports">📊 Gerar Relatórios</Button>
        </div>
      </div>
    </Card>

    <!-- Tabs -->
    <div class="mb-6">
      <div class="border-b border-gray-200">
        <nav class="-mb-px flex space-x-8">
          <button
            :class="[
              'py-4 px-1 border-b-2 font-medium text-sm',
              activeTab === 'consolidated'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            ]"
            @click="activeTab = 'consolidated'"
          >
            📊 Consolidado
          </button>
          <button
            :class="[
              'py-4 px-1 border-b-2 font-medium text-sm',
              activeTab === 'production'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            ]"
            @click="activeTab = 'production'"
          >
            🏭 Produção
          </button>
          <button
            :class="[
              'py-4 px-1 border-b-2 font-medium text-sm',
              activeTab === 'efficiency'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            ]"
            @click="activeTab = 'efficiency'"
          >
            ⚡ Eficiência
          </button>
          <button
            :class="[
              'py-4 px-1 border-b-2 font-medium text-sm',
              activeTab === 'quality'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            ]"
            @click="activeTab = 'quality'"
          >
            ✅ Qualidade
          </button>
        </nav>
      </div>
    </div>

    <!-- Carregando — mesma linguagem visual do spinner do DataTable /
         PCPDashboardView (§4.2 variante C). Antes `loading` só desabilitava o
         botão: gerar os 4 relatórios não dava sinal nenhum de progresso. -->
    <div v-if="loading" class="text-center py-12">
      <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      <p class="mt-4 text-gray-600">Gerando relatórios...</p>
    </div>

    <!-- Erro — faixa canônica de PCPDashboardView.vue:12-15 / DataTable (I11).
         Antes a falha só virava toast + `console.error`, e a tela voltava ao
         estado "Nenhum relatório gerado", indistinguível de "ainda não pedi". -->
    <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
      <p class="text-red-600">{{ error }}</p>
      <Button class="mt-4" @click="loadReports">Tentar Novamente</Button>
    </div>

    <!-- Vazio: nenhum relatório pedido ainda. -->
    <Card v-else-if="!hasReports">
      <div class="text-center py-12 text-gray-500">
        <div class="text-6xl mb-4">📊</div>
        <p class="text-lg font-medium mb-2">Nenhum relatório gerado</p>
        <p class="text-sm">Selecione um período e clique em "Gerar Relatórios"</p>
      </div>
    </Card>

    <template v-else>
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
                <span class="font-bold text-lg text-green-600">{{ consolidatedReport.production.completed }}</span>
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
                <span class="font-bold text-xl text-green-600">{{ consolidatedReport.efficiency.onTimeRate?.toFixed(1) }}%</span>
              </div>
            </div>
          </Card>

          <Card title="✅ Resumo de Qualidade">
            <div class="space-y-3">
              <div class="flex justify-between py-2 border-b">
                <span class="text-gray-600">Total Produzido:</span>
                <span class="font-bold text-lg text-green-600">{{ consolidatedReport.quality.totalProduced }}</span>
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
                <span class="font-bold text-xl text-green-600">{{ consolidatedReport.quality.avgQualityRate?.toFixed(1) }}%</span>
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
              <p class="text-2xl font-bold text-green-600">{{ productionReport.summary.completed }}</p>
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

        <!-- Tabela de detalhe: tabela simples, não DataTable. Ela só é renderizada
             depois que os 4 relatórios do período já resolveram (os estados
             carregando/erro/vazio são da página inteira, tratados acima), então
             3 dos 4 estados do DataTable seriam inalcançáveis aqui — mesmo
             raciocínio da tabela de itens do modal de PurchaseOrdersView (Lote 4).
             Vale para as 3 tabelas de detalhe desta view. -->
        <Card title="Produção por Produto">
          <div v-if="productionReport.byProduct?.length > 0" class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th scope="col" class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Produto</th>
                  <th scope="col" class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Ordens</th>
                  <th scope="col" class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Planejado</th>
                  <th scope="col" class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Produzido</th>
                  <th scope="col" class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Refugo</th>
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
              <p class="text-2xl font-bold text-green-600">{{ efficiencyReport.summary.avgTimeEfficiency?.toFixed(1) }}%</p>
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
                  <th scope="col" class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ordem</th>
                  <th scope="col" class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Planej.</th>
                  <th scope="col" class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Produz.</th>
                  <th scope="col" class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Efic. Qtd</th>
                  <th scope="col" class="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Prazo</th>
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
                    <StatusBadge
                      :label="order.onTime ? 'Sim' : 'Não'"
                      :tone="order.onTime ? 'success' : 'danger'"
                    />
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
              <p class="text-2xl font-bold text-green-600">{{ qualityReport.summary.totalProduced }}</p>
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
                  <th scope="col" class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Produto</th>
                  <th scope="col" class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Produzido</th>
                  <th scope="col" class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Refugo</th>
                  <th scope="col" class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Taxa Refugo</th>
                  <th scope="col" class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qualidade</th>
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
                  <td class="px-4 py-2 text-right text-sm font-semibold text-green-600">{{ item.qualityRate?.toFixed(1) }}%</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="text-center py-8 text-gray-500">
            Nenhum dado disponível
          </div>
        </Card>
      </div>
    </template>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useReportsStore } from '@/stores/reports.store';
import AppLayout from '@/components/common/AppLayout.vue';
import Button from '@/components/common/Button.vue';
import Card from '@/components/common/Card.vue';
import FormField from '@/components/common/FormField.vue';
import StatusBadge from '@/components/common/StatusBadge.vue';
import { useToast } from '@/composables/useToast';

const reportsStore = useReportsStore();
const toast = useToast();

const activeTab = ref<'consolidated' | 'production' | 'efficiency' | 'quality'>('consolidated');
const loading = ref(false);
// §4.4-5 / I11: erro de geração é um estado próprio da área de conteúdo,
// não mais só um toast que some.
const error = ref('');

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
    toast.warning('Por favor, selecione o período');
    return;
  }

  loading.value = true;
  error.value = '';
  try {
    await Promise.all([
      reportsStore.fetchProductionReport(filters.value.startDate, filters.value.endDate),
      reportsStore.fetchEfficiencyReport(filters.value.startDate, filters.value.endDate),
      reportsStore.fetchQualityReport(filters.value.startDate, filters.value.endDate),
      reportsStore.fetchConsolidatedReport(filters.value.startDate, filters.value.endDate),
    ]);
  } catch (e: any) {
    error.value = e.response?.data?.message || e.message || 'Erro ao carregar relatórios';
    toast.error('Erro ao carregar relatórios');
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
</script>
