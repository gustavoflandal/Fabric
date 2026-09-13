<template>
  <AppLayout title="Transferência de Estoque" subtitle="Mova material entre dois endereços do armazém">
    <Card class="max-w-3xl">
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <FormField id="transfer-product" label="Produto" required>
          <select
            v-model="form.productId"
            required
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
          >
            <option value="">Selecione...</option>
            <option v-for="product in products" :key="product.id" :value="product.id">
              {{ product.code }} - {{ product.name }}
            </option>
          </select>
        </FormField>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            id="transfer-from-code"
            label="Posição de Origem"
            required
            :error="fromError"
            hint="Código do endereço, ex. ARM-RUA-AA-PP"
          >
            <input
              v-model="fromCode"
              type="text"
              required
              placeholder="ARM-RUA-AA-PP"
              class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              @blur="resolveFromPosition"
              @keydown.enter.prevent="resolveFromPosition"
            />
          </FormField>
          <FormField
            id="transfer-to-code"
            label="Posição de Destino"
            required
            :error="toError"
            hint="Código do endereço, ex. ARM-RUA-AA-PP"
          >
            <input
              v-model="toCode"
              type="text"
              required
              placeholder="ARM-RUA-AA-PP"
              class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              @blur="resolveToPosition"
              @keydown.enter.prevent="resolveToPosition"
            />
          </FormField>
        </div>

        <!-- Contexto visual da origem resolvida + mini-histórico (F2.3/brief item 4). Não é
             crítico para o fluxo — a validação real acontece no backend. -->
        <div v-if="resolvedFrom" class="border border-gray-200 rounded-lg p-3 bg-gray-50">
          <p class="text-sm text-gray-700">
            <span class="font-medium">{{ resolvedFrom.code }}</span>
            — {{ resolvedFrom.structure?.warehouse?.name ?? resolvedFrom.warehouseCode }}
            <span v-if="resolvedFrom.blocked" class="ml-2 text-red-600 font-medium">(Bloqueada)</span>
          </p>
          <p class="text-xs font-semibold text-gray-500 uppercase mt-3 mb-2">Últimas movimentações</p>
          <div v-if="loadingFromHistory" class="text-sm text-gray-400">Carregando histórico...</div>
          <ul v-else-if="fromMovements.length" class="space-y-1">
            <li v-for="mov in fromMovements" :key="mov.id" class="text-sm text-gray-600 flex justify-between gap-4">
              <span>{{ mov.product?.code }} — {{ mov.direction === 'IN' ? 'Entrada' : 'Saída' }} ({{ mov.quantity }})</span>
              <span class="text-gray-400 whitespace-nowrap">{{ formatDate(mov.createdAt) }}</span>
            </li>
          </ul>
          <p v-else class="text-sm text-gray-400">Nenhuma movimentação recente neste endereço.</p>
        </div>

        <div v-if="resolvedTo" class="text-sm text-gray-700">
          <span class="font-medium">{{ resolvedTo.code }}</span>
          — {{ resolvedTo.structure?.warehouse?.name ?? resolvedTo.warehouseCode }}
          <span v-if="resolvedTo.blocked" class="ml-2 text-red-600 font-medium">(Bloqueada)</span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField id="transfer-quantity" label="Quantidade" required>
            <input
              v-model.number="form.quantity"
              type="number"
              required
              min="0.01"
              step="0.01"
              class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            />
          </FormField>
          <FormField id="transfer-reason" label="Motivo" required hint="Entre 3 e 255 caracteres">
            <input
              v-model="form.reason"
              type="text"
              required
              minlength="3"
              maxlength="255"
              placeholder="Ex: Reorganização de endereço"
              class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            />
          </FormField>
        </div>

        <!-- Só aparece para produto com lotTracked — brief item 3. -->
        <FormField
          v-if="selectedProductLotTracked"
          id="transfer-lot"
          label="Lote"
          hint="ID do lote de origem (obrigatório na prática para produto com controle de lote)"
        >
          <!--
            Débito técnico conhecido: campo de texto livre para o UUID do lote,
            não um seletor. Não existe hoje nenhum endpoint de backend para
            buscar/listar lotes por produto+posição (só telas que CRIAM lote no
            recebimento) — construir um seletor de verdade é trabalho de
            backend novo, fora do escopo desta tela. Fica documentado aqui pra
            não virar só uma nota perdida de relatório de implementação.
          -->
          <input
            v-model="form.lotId"
            type="text"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
          />
        </FormField>

        <div class="flex gap-3 pt-4">
          <Button type="button" variant="outline" class="flex-1" @click="resetForm">Limpar</Button>
          <Button type="submit" class="flex-1" :disabled="!canSubmit || submitting">
            {{ submitting ? 'Transferindo...' : 'Confirmar Transferência' }}
          </Button>
        </div>
      </form>
    </Card>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useStockStore } from '@/stores/stock.store';
import { useProductStore } from '@/stores/product.store';
import { storagePositionService } from '@/services/storage-position.service';
import AppLayout from '@/components/common/AppLayout.vue';
import Button from '@/components/common/Button.vue';
import Card from '@/components/common/Card.vue';
import FormField from '@/components/common/FormField.vue';
import { useToast } from '@/composables/useToast';
import { confirmDialog } from '@/composables/useConfirm';
import type { Product } from '@/services/product.service';
import type { ApiError, StoragePosition, StoragePositionMovement } from '@/types/warehouse.types';

const stockStore = useStockStore();
const productStore = useProductStore();
const toast = useToast();

const products = ref<Product[]>([]);
const submitting = ref(false);

const form = ref({
  productId: '',
  quantity: 0,
  reason: '',
  lotId: '',
});

const fromCode = ref('');
const toCode = ref('');
const fromError = ref('');
const toError = ref('');
const resolvedFrom = ref<StoragePosition | null>(null);
const resolvedTo = ref<StoragePosition | null>(null);
const fromMovements = ref<StoragePositionMovement[]>([]);
const loadingFromHistory = ref(false);

const selectedProduct = computed(() => products.value.find((p) => p.id === form.value.productId) ?? null);
const selectedProductLotTracked = computed(() => selectedProduct.value?.lotTracked === true);

// Validação client-side básica (brief item 5) — origem ≠ destino e quantidade > 0.
// A validação de verdade (saldo, bloqueio, lote vencido) é do backend.
const canSubmit = computed(() => {
  return (
    !!form.value.productId &&
    !!resolvedFrom.value &&
    !!resolvedTo.value &&
    resolvedFrom.value.id !== resolvedTo.value.id &&
    form.value.quantity > 0 &&
    form.value.reason.trim().length >= 3
  );
});

const resolveFromPosition = async () => {
  const code = fromCode.value.trim();
  fromError.value = '';
  resolvedFrom.value = null;
  fromMovements.value = [];
  if (!code) return;

  try {
    const result = await storagePositionService.getPositionByCode(code);
    resolvedFrom.value = result.data;
    await loadFromHistory(result.data.id);
  } catch (e) {
    fromError.value = (e as ApiError).response?.data?.message || 'Posição de origem não encontrada';
  }
};

const loadFromHistory = async (positionId: string) => {
  loadingFromHistory.value = true;
  try {
    const result = await storagePositionService.getMovements(positionId, { limit: 5 });
    fromMovements.value = result.data?.movements ?? [];
  } catch {
    // Mini-histórico é só contexto visual (brief item 4) — falha aqui não bloqueia o formulário.
    fromMovements.value = [];
  } finally {
    loadingFromHistory.value = false;
  }
};

const resolveToPosition = async () => {
  const code = toCode.value.trim();
  toError.value = '';
  resolvedTo.value = null;
  if (!code) return;

  try {
    const result = await storagePositionService.getPositionByCode(code);
    resolvedTo.value = result.data;
  } catch (e) {
    toError.value = (e as ApiError).response?.data?.message || 'Posição de destino não encontrada';
  }
};

const loadProducts = async () => {
  try {
    await productStore.fetchProducts(1, 1000, { active: true });
    products.value = productStore.products;
  } catch (e) {
    toast.error((e as ApiError).response?.data?.message || 'Erro ao carregar produtos');
  }
};

const resetForm = () => {
  form.value = { productId: '', quantity: 0, reason: '', lotId: '' };
  fromCode.value = '';
  toCode.value = '';
  fromError.value = '';
  toError.value = '';
  resolvedFrom.value = null;
  resolvedTo.value = null;
  fromMovements.value = [];
};

const formatDate = (date: string) => new Date(date).toLocaleString('pt-BR');

const handleSubmit = async () => {
  if (!canSubmit.value || !resolvedFrom.value || !resolvedTo.value) {
    toast.error('Revise os dados: origem, destino e quantidade são obrigatórios, e origem deve ser diferente do destino.');
    return;
  }

  const productLabel = selectedProduct.value
    ? `${selectedProduct.value.code} - ${selectedProduct.value.name}`
    : form.value.productId;
  const confirmed = await confirmDialog(
    `Transferir ${form.value.quantity} de "${productLabel}" de ${resolvedFrom.value.code} para ${resolvedTo.value.code}?`,
    { title: 'Confirmar transferência' }
  );
  if (!confirmed) return;

  submitting.value = true;
  try {
    await stockStore.transfer({
      productId: form.value.productId,
      fromPositionId: resolvedFrom.value.id,
      toPositionId: resolvedTo.value.id,
      quantity: form.value.quantity,
      reason: form.value.reason.trim(),
      lotId: selectedProductLotTracked.value && form.value.lotId ? form.value.lotId : undefined,
    });
    toast.success('Transferência registrada com sucesso!');
    resetForm();
  } catch (e) {
    toast.error((e as ApiError).response?.data?.message || 'Erro ao registrar transferência');
  } finally {
    submitting.value = false;
  }
};

onMounted(() => {
  loadProducts();
});
</script>
