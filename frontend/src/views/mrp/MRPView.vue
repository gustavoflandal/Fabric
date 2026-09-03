<template>
  <AppLayout title="MRP - Planejamento de Materiais" subtitle="Cálculo de necessidades de materiais">
    <template #actions>
      <Button :disabled="loading" @click="handleExecuteAll">🔄 Executar MRP Completo</Button>
    </template>

    <!-- Carregando — mesma linguagem visual do spinner do DataTable/PCPDashboardView
         (§4.2 variante C). Antes `loading` só desabilitava o botão: a área de
         conteúdo ficava vazia, sem explicação nenhuma. -->
    <div v-if="loading" class="text-center py-12">
      <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      <p class="mt-4 text-gray-600">Carregando dados do MRP...</p>
    </div>

    <!-- Erro — faixa canônica de PCPDashboardView.vue:12-15 / DataTable (I11).
         Antes uma falha caía num `console.error` mudo e a página ficava sem os
         cards (`v-if="summary"`), como se não houvesse dado nenhum. -->
    <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
      <p class="text-red-600">{{ error }}</p>
      <Button class="mt-4" @click="loadData">Tentar Novamente</Button>
    </div>

    <div v-else>
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
            <p class="text-2xl font-bold text-green-600">{{ summary.totalToProduce }}</p>
            <p class="text-sm text-gray-600">Itens para Produzir</p>
          </div>
        </Card>
      </div>

      <!-- Tabs -->
      <div class="mb-6">
        <div class="border-b border-gray-200">
          <nav class="-mb-px flex space-x-8">
            <button
              :class="[
                'py-4 px-1 border-b-2 font-medium text-sm',
                activeTab === 'suggestions'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              ]"
              @click="activeTab = 'suggestions'"
            >
              Sugestões
            </button>
            <button
              :class="[
                'py-4 px-1 border-b-2 font-medium text-sm',
                activeTab === 'results'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              ]"
              @click="activeTab = 'results'"
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
                  <StatusBadge
                    :label="getPriorityLabel(suggestion.priority)"
                    :tone="getPriorityTone(suggestion.priority)"
                  />
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
                  <StatusBadge
                    :label="getPriorityLabel(suggestion.priority)"
                    :tone="getPriorityTone(suggestion.priority)"
                  />
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

              <!-- Tabela de requisitos: tabela simples, não DataTable. Ela vive
                   dentro de um resultado já carregado com a página, então
                   carregando/erro/vazio próprios não existem aqui — os 3 estados
                   são da página inteira, tratados nos blocos acima. Mesmo
                   raciocínio da tabela de itens do modal de PurchaseOrdersView
                   (Lote 4). -->
              <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                  <thead class="bg-gray-50">
                    <tr>
                      <th scope="col" class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Produto</th>
                      <th scope="col" class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Necessário</th>
                      <th scope="col" class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Disponível</th>
                      <th scope="col" class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Em Pedido</th>
                      <th scope="col" class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Necessidade Líquida</th>
                      <th scope="col" class="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Ação</th>
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
                        <StatusBadge
                          :label="getActionLabel(req.suggestedAction)"
                          :tone="getActionTone(req.suggestedAction)"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useMRPStore } from '@/stores/mrp.store';
import type {
  MRPResult,
  MRPSummary,
  ProductionSuggestion,
  PurchaseSuggestion,
} from '@/services/mrp.service';
import AppLayout from '@/components/common/AppLayout.vue';
import Button from '@/components/common/Button.vue';
import Card from '@/components/common/Card.vue';
import StatusBadge, { type BadgeTone } from '@/components/common/StatusBadge.vue';

const mrpStore = useMRPStore();

const activeTab = ref<'suggestions' | 'results'>('suggestions');
const loading = ref(false);
// §4.4-5 / I11: falha de carregamento agora é um estado visível, não um
// `console.error` mudo com a tela em branco.
const error = ref('');

const summary = ref<MRPSummary | null>(mrpStore.summary);
const results = ref<MRPResult[]>(mrpStore.results);
const purchaseSuggestions = ref<PurchaseSuggestion[]>(mrpStore.purchaseSuggestions);
const productionSuggestions = ref<ProductionSuggestion[]>(mrpStore.productionSuggestions);

// red/yellow/green do badge antigo normalizados para a paleta do StatusBadge
// (§4.2): HIGH = danger (ruptura iminente), MEDIUM = warning, LOW = success
// (folga confortável — era o verde do código antigo).
const PRIORITY_TONES: Record<string, BadgeTone> = {
  HIGH: 'danger',
  MEDIUM: 'warning',
  LOW: 'success',
};

const PRIORITY_LABELS: Record<string, string> = {
  HIGH: 'Alta',
  MEDIUM: 'Média',
  LOW: 'Baixa',
};

function getPriorityTone(priority: string): BadgeTone {
  return PRIORITY_TONES[priority] || 'neutral';
}

function getPriorityLabel(priority: string): string {
  return PRIORITY_LABELS[priority] || priority;
}

// BUY = info (ação de compra, azul do código antigo), PRODUCE = success (verde),
// tudo o mais (NONE/OK) = neutral (cinza) — nada a fazer.
const ACTION_TONES: Record<string, BadgeTone> = {
  BUY: 'info',
  PRODUCE: 'success',
};

const ACTION_LABELS: Record<string, string> = {
  BUY: 'Comprar',
  PRODUCE: 'Produzir',
};

function getActionTone(action: string): BadgeTone {
  return ACTION_TONES[action] || 'neutral';
}

function getActionLabel(action: string): string {
  return ACTION_LABELS[action] || 'OK';
}

onMounted(async () => {
  await loadData();
});

async function loadData() {
  loading.value = true;
  error.value = '';
  try {
    await Promise.all([
      mrpStore.fetchSummary(),
      mrpStore.fetchPurchaseSuggestions(),
      mrpStore.fetchProductionSuggestions(),
    ]);
    summary.value = mrpStore.summary;
    purchaseSuggestions.value = mrpStore.purchaseSuggestions;
    productionSuggestions.value = mrpStore.productionSuggestions;
  } catch (e: any) {
    error.value = e.response?.data?.message || e.message || 'Erro ao carregar dados do MRP';
  } finally {
    loading.value = false;
  }
}

async function handleExecuteAll() {
  loading.value = true;
  error.value = '';
  try {
    await mrpStore.executeForAllPending();
    results.value = mrpStore.results;
    activeTab.value = 'results';
    await loadData();
  } catch (e: any) {
    error.value = e.response?.data?.message || e.message || 'Erro ao executar MRP';
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
