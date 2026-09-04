<template>
  <AppLayout title="Estoque" subtitle="Controle de saldos e movimentações">
    <template #actions>
      <div class="flex items-center space-x-2">
        <Button
          v-if="lastMovement"
          variant="outline"
          @click="printMovementReceipt(lastMovement, lastMovementProductLabel)"
        >
          🖨️ Imprimir Último Comprovante
        </Button>
        <Button variant="outline" @click="showMovementModal = true">⬆️ Entrada</Button>
        <Button variant="outline" @click="showExitModal = true">⬇️ Saída</Button>
        <Button @click="showAdjustmentModal = true">🔧 Ajuste</Button>
      </div>
    </template>

    <!-- Cards de resumo: não são tabela nem formulário, então ficam como estavam
         (§4.2 não define um componente para eles). Cores já dentro da paleta. -->
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
          <p class="text-2xl font-bold text-green-600">{{ summary.ok }}</p>
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

    <!-- Filtros -->
    <Card class="mb-6">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <FormField id="stock-filter-status" label="Status">
          <select
            v-model="filters.status"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            @change="loadBalances"
          >
            <option value="">Todos</option>
            <option value="OK">OK</option>
            <option value="LOW">Baixo</option>
            <option value="CRITICAL">Crítico</option>
            <option value="EXCESS">Excesso</option>
          </select>
        </FormField>
        <FormField id="stock-filter-type" label="Tipo">
          <select
            v-model="filters.type"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            @change="loadBalances"
          >
            <option value="">Todos</option>
            <option value="RAW_MATERIAL">Matéria-Prima</option>
            <option value="SEMI_FINISHED">Semi-Acabado</option>
            <option value="FINISHED_PRODUCT">Produto Acabado</option>
          </select>
        </FormField>
        <div class="col-span-2 flex items-end">
          <Button full-width @click="loadBalances">🔍 Filtrar</Button>
        </div>
      </div>
    </Card>

    <!-- Saldos -->
    <DataTable
      :loading="loading"
      :error="error"
      :items="balances"
      empty-title="Nenhum produto encontrado"
      empty-hint="Ajuste os filtros para ver outros saldos de estoque."
      @retry="loadBalances"
    >
      <template #head>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          Produto
        </th>
        <th scope="col" class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
          Quantidade
        </th>
        <th scope="col" class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
          Mín / Máx
        </th>
        <th scope="col" class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
          Status
        </th>
        <th scope="col" class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
          Ações
        </th>
      </template>

      <template #row="{ item }">
        <td class="px-6 py-4">
          <div class="text-sm font-medium text-gray-900">{{ item.product.code }}</div>
          <div class="text-xs text-gray-500">{{ item.product.name }}</div>
        </td>
        <td class="px-6 py-4 text-center">
          <span class="text-sm font-semibold text-gray-900">{{ item.quantity }}</span>
        </td>
        <td class="px-6 py-4 text-center text-sm text-gray-600">
          {{ item.minStock }} / {{ item.maxStock }}
        </td>
        <td class="px-6 py-4 text-center">
          <StatusBadge
            :label="getBalanceStatusLabel(item.status)"
            :tone="getBalanceStatusTone(item.status)"
          />
        </td>
        <td class="px-6 py-4 text-center">
          <button
            class="text-primary-600 hover:text-primary-900 text-sm font-medium"
            @click="viewMovements(item.productId)"
          >
            Ver Movimentações
          </button>
        </td>
      </template>
    </DataTable>

    <!-- Modal de Entrada — Esc/focus trap vêm do AppModal (§4.2). -->
    <AppModal v-model="showMovementModal" size="sm" title="Registrar Entrada">
      <form class="space-y-4" @submit.prevent="handleRegisterEntry">
        <FormField id="stock-entry-product" label="Produto" required>
          <input
            v-model="movementForm.productId"
            type="text"
            required
            placeholder="ID do Produto"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
          />
        </FormField>
        <FormField id="stock-entry-quantity" label="Quantidade" required>
          <input
            v-model.number="movementForm.quantity"
            type="number"
            required
            min="0.01"
            step="0.01"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
          />
        </FormField>
        <FormField id="stock-entry-reason" label="Motivo" required>
          <input
            v-model="movementForm.reason"
            type="text"
            required
            placeholder="Ex: Compra, Devolução"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
          />
        </FormField>
        <FormField id="stock-entry-reference" label="Referência (opcional)">
          <input
            v-model="movementForm.reference"
            type="text"
            placeholder="Ex: NF-12345"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
          />
        </FormField>
        <div class="flex gap-3 pt-4">
          <Button type="button" variant="outline" class="flex-1" @click="showMovementModal = false">
            Cancelar
          </Button>
          <Button type="submit" class="flex-1">Registrar</Button>
        </div>
      </form>
    </AppModal>

    <!-- Modal de Saída -->
    <AppModal v-model="showExitModal" size="sm" title="Registrar Saída">
      <form class="space-y-4" @submit.prevent="handleRegisterExit">
        <FormField id="stock-exit-product" label="Produto" required>
          <input
            v-model="exitForm.productId"
            type="text"
            required
            placeholder="ID do Produto"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
          />
        </FormField>
        <FormField id="stock-exit-quantity" label="Quantidade" required>
          <input
            v-model.number="exitForm.quantity"
            type="number"
            required
            min="0.01"
            step="0.01"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
          />
        </FormField>
        <FormField id="stock-exit-reason" label="Motivo" required>
          <input
            v-model="exitForm.reason"
            type="text"
            required
            placeholder="Ex: Produção, Venda"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
          />
        </FormField>
        <FormField id="stock-exit-reference" label="Referência (opcional)">
          <input
            v-model="exitForm.reference"
            type="text"
            placeholder="Ex: OP-2025-001"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
          />
        </FormField>
        <div class="flex gap-3 pt-4">
          <Button type="button" variant="outline" class="flex-1" @click="showExitModal = false">
            Cancelar
          </Button>
          <Button type="submit" class="flex-1">Registrar</Button>
        </div>
      </form>
    </AppModal>

    <!-- Modal de Ajuste -->
    <AppModal v-model="showAdjustmentModal" size="sm" title="Registrar Ajuste">
      <form class="space-y-4" @submit.prevent="handleRegisterAdjustment">
        <FormField id="stock-adjustment-product" label="Produto" required>
          <input
            v-model="adjustmentForm.productId"
            type="text"
            required
            placeholder="ID do Produto"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
          />
        </FormField>
        <FormField id="stock-adjustment-quantity" label="Quantidade (pode ser negativa)" required>
          <input
            v-model.number="adjustmentForm.quantity"
            type="number"
            required
            step="0.01"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
          />
        </FormField>
        <FormField id="stock-adjustment-reason" label="Motivo" required>
          <input
            v-model="adjustmentForm.reason"
            type="text"
            required
            placeholder="Ex: Inventário, Correção"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
          />
        </FormField>
        <div class="flex gap-3 pt-4">
          <Button type="button" variant="outline" class="flex-1" @click="showAdjustmentModal = false">
            Cancelar
          </Button>
          <Button type="submit" class="flex-1">Registrar</Button>
        </div>
      </form>
    </AppModal>

    <!-- Modal de Movimentações — somente leitura.
         Aqui a lista É buscada com o modal já aberto (`viewMovements` abre e só
         depois chama `fetchMovements`), então os 4 estados do DataTable são todos
         alcançáveis: carregando, erro, vazio e dados. Diferente do modal de
         visualização de PurchaseOrdersView (Lote 4), onde o modal só abre com os
         dados já resolvidos e por isso a tabela ficou simples. Por isso usamos
         DataTable de verdade, e o erro passou a ser exibido na faixa com
         "Tentar Novamente" (antes só havia um toast, que sumia e deixava o
         modal parecendo "sem movimentações"). -->
    <AppModal v-model="showMovementsModal" size="lg" title="Movimentações do Produto">
      <DataTable
        :loading="loadingMovements"
        :error="movementsError"
        :items="movements"
        empty-title="Nenhuma movimentação registrada para este produto"
        empty-hint="As movimentações aparecerão aqui quando forem registradas."
        @retry="loadMovements(movementsProductId)"
      >
        <template #head>
          <th scope="col" class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
          <th scope="col" class="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Tipo</th>
          <th scope="col" class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Quantidade</th>
          <th scope="col" class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Motivo</th>
          <th scope="col" class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Referência</th>
          <th scope="col" class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
        </template>

        <template #row="{ item }">
          <td class="px-4 py-2 text-sm text-gray-900">{{ formatDateTime(item.createdAt) }}</td>
          <td class="px-4 py-2 text-center">
            <StatusBadge
              :label="getMovementTypeLabel(item.type)"
              :tone="getMovementTypeTone(item.type)"
            />
          </td>
          <td
            class="px-4 py-2 text-right text-sm font-semibold"
            :class="item.type === 'IN' ? 'text-green-600' : 'text-red-600'"
          >
            {{ item.type === 'IN' ? '+' : '-' }}{{ item.quantity }}
          </td>
          <td class="px-4 py-2 text-sm text-gray-600">{{ item.reason }}</td>
          <td class="px-4 py-2 text-sm text-gray-500">{{ item.reference || '-' }}</td>
          <td class="px-4 py-2 text-right text-sm">
            <button
              class="text-primary-600 hover:text-primary-900 font-medium"
              @click="printMovementReceipt(item, movementsProductLabel)"
            >
              Imprimir
            </button>
          </td>
        </template>
      </DataTable>

      <template #footer>
        <div class="flex justify-end">
          <Button type="button" variant="outline" @click="showMovementsModal = false">Fechar</Button>
        </div>
      </template>
    </AppModal>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useStockStore } from '@/stores/stock.store';
import type { StockBalance, StockMovement, StockSummary } from '@/services/stock.service';
import AppLayout from '@/components/common/AppLayout.vue';
import AppModal from '@/components/common/AppModal.vue';
import Button from '@/components/common/Button.vue';
import Card from '@/components/common/Card.vue';
import DataTable from '@/components/common/DataTable.vue';
import FormField from '@/components/common/FormField.vue';
import StatusBadge, { type BadgeTone } from '@/components/common/StatusBadge.vue';
import { useToast } from '@/composables/useToast';
import { useAuthStore } from '@/stores/auth.store';
import { generatePDF, formatDate as formatDatePDF } from '@/utils/pdf-generator';

const stockStore = useStockStore();
const toast = useToast();
const authStore = useAuthStore();

const loading = ref(false);
// §4.4-5 / I11: erro de carregamento é um estado próprio, nunca "lista vazia".
// Antes só existia `console.error`, então uma falha de rede aparecia como
// "Nenhum produto encontrado".
const error = ref('');
const summary = ref<StockSummary | null>(stockStore.summary);
const balances = ref<StockBalance[]>(stockStore.balances);

const filters = ref({
  status: '',
  type: '',
});

const showMovementModal = ref(false);
const showExitModal = ref(false);
const showAdjustmentModal = ref(false);
const showMovementsModal = ref(false);
const loadingMovements = ref(false);
const movementsError = ref('');
const movementsProductId = ref('');
const movementsProductLabel = ref('');
const movements = ref<StockMovement[]>([]);
const lastMovement = ref<StockMovement | null>(null);
const lastMovementProductLabel = ref('');

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

// green/yellow/red/blue do badge antigo normalizados para a paleta do StatusBadge
// (§4.2): OK = success (dentro da faixa), LOW = warning (ainda operável, exige
// atenção), CRITICAL = danger (ruptura iminente), EXCESS = info — excesso é um
// desvio a comunicar, não uma falha, e era justamente o azul do código antigo.
const BALANCE_STATUS_TONES: Record<string, BadgeTone> = {
  OK: 'success',
  LOW: 'warning',
  CRITICAL: 'danger',
  EXCESS: 'info',
};

const BALANCE_STATUS_LABELS: Record<string, string> = {
  OK: 'OK',
  LOW: 'Baixo',
  CRITICAL: 'Crítico',
  EXCESS: 'Excesso',
};

function getBalanceStatusTone(status: string): BadgeTone {
  return BALANCE_STATUS_TONES[status] || 'neutral';
}

function getBalanceStatusLabel(status: string): string {
  return BALANCE_STATUS_LABELS[status] || status;
}

// IN = success (entra), OUT = danger (sai), ADJUSTMENT = warning (correção manual)
// — mesmas cores do badge antigo, agora pela paleta.
const MOVEMENT_TYPE_TONES: Record<string, BadgeTone> = {
  IN: 'success',
  OUT: 'danger',
  ADJUSTMENT: 'warning',
};

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  IN: 'Entrada',
  OUT: 'Saída',
  ADJUSTMENT: 'Ajuste',
};

function getMovementTypeTone(type: string): BadgeTone {
  return MOVEMENT_TYPE_TONES[type] || 'neutral';
}

function getMovementTypeLabel(type: string): string {
  return MOVEMENT_TYPE_LABELS[type] || type;
}

onMounted(async () => {
  await loadData();
});

async function loadData() {
  loading.value = true;
  error.value = '';
  try {
    await Promise.all([stockStore.fetchSummary(), stockStore.fetchBalances()]);
    summary.value = stockStore.summary;
    balances.value = stockStore.balances;
  } catch (e: any) {
    error.value = e.response?.data?.message || e.message || 'Erro ao carregar dados do estoque';
  } finally {
    loading.value = false;
  }
}

async function loadBalances() {
  loading.value = true;
  error.value = '';
  try {
    await stockStore.fetchBalances({
      status: filters.value.status as any,
      type: filters.value.type,
    });
    balances.value = stockStore.balances;
  } catch (e: any) {
    error.value = e.response?.data?.message || e.message || 'Erro ao filtrar saldos';
  } finally {
    loading.value = false;
  }
}

async function handleRegisterEntry() {
  try {
    const productId = movementForm.value.productId;
    const created = await stockStore.registerEntry(movementForm.value);
    lastMovement.value = created;
    showMovementModal.value = false;
    movementForm.value = { productId: '', quantity: 0, reason: '', reference: '' };
    await loadData();
    const balance = balances.value.find((b) => b.productId === productId);
    lastMovementProductLabel.value = balance ? `${balance.product.code} - ${balance.product.name}` : productId;
    toast.success('Entrada registrada com sucesso! Use "Imprimir Último Comprovante" se precisar do papel.');
  } catch (error) {
    console.error('Erro ao registrar entrada:', error);
    toast.error('Erro ao registrar entrada');
  }
}

async function handleRegisterExit() {
  try {
    const productId = exitForm.value.productId;
    const created = await stockStore.registerExit(exitForm.value);
    lastMovement.value = created;
    showExitModal.value = false;
    exitForm.value = { productId: '', quantity: 0, reason: '', reference: '' };
    await loadData();
    const balance = balances.value.find((b) => b.productId === productId);
    lastMovementProductLabel.value = balance ? `${balance.product.code} - ${balance.product.name}` : productId;
    toast.success('Saída registrada com sucesso! Use "Imprimir Último Comprovante" se precisar do papel.');
  } catch (error) {
    console.error('Erro ao registrar saída:', error);
    toast.error('Erro ao registrar saída');
  }
}

async function handleRegisterAdjustment() {
  try {
    const productId = adjustmentForm.value.productId;
    const created = await stockStore.registerAdjustment(adjustmentForm.value);
    lastMovement.value = created;
    showAdjustmentModal.value = false;
    adjustmentForm.value = { productId: '', quantity: 0, reason: '' };
    await loadData();
    const balance = balances.value.find((b) => b.productId === productId);
    lastMovementProductLabel.value = balance ? `${balance.product.code} - ${balance.product.name}` : productId;
    toast.success('Ajuste registrado com sucesso! Use "Imprimir Último Comprovante" se precisar do papel.');
  } catch (error) {
    console.error('Erro ao registrar ajuste:', error);
    toast.error('Erro ao registrar ajuste');
  }
}

function viewMovements(productId: string) {
  movementsProductId.value = productId;
  const balance = balances.value.find((b) => b.productId === productId);
  movementsProductLabel.value = balance ? `${balance.product.code} - ${balance.product.name}` : productId;
  showMovementsModal.value = true;
  return loadMovements(productId);
}

async function loadMovements(productId: string) {
  if (!productId) return;
  loadingMovements.value = true;
  movementsError.value = '';
  movements.value = [];

  try {
    await stockStore.fetchMovements(productId);
    movements.value = stockStore.movements;
  } catch (e: any) {
    movementsError.value =
      e.response?.data?.message || e.message || 'Erro ao carregar movimentações';
  } finally {
    loadingMovements.value = false;
  }
}

function formatDateTime(date: string) {
  return new Date(date).toLocaleString('pt-BR');
}

function printMovementReceipt(movement: {
  type: string;
  quantity: number;
  reason: string;
  reference?: string;
  createdAt: string;
}, productLabel: string) {
  const pdf = generatePDF({
    title: 'Comprovante de Movimentação de Estoque',
    subtitle: productLabel,
    data: {
      Tipo: getMovementTypeLabel(movement.type),
      Quantidade: String(movement.quantity),
      Motivo: movement.reason,
      Referência: movement.reference || '-',
      Data: formatDatePDF(movement.createdAt),
      Usuário: authStore.userName,
    },
    signature: { label: 'Assinatura de Quem Executou' },
  });

  pdf.save(`Movimentacao_${movement.type}_${new Date(movement.createdAt).getTime()}.pdf`);
}
</script>
