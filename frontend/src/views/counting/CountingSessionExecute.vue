<template>
  <div class="min-h-screen bg-gray-50">
    <AppHeader />

    <!-- Progress Bar -->
    <div class="bg-white border-b border-gray-200 px-4 py-3">
      <div class="flex justify-between text-sm text-gray-600 mb-2">
        <span>Progresso</span>
        <span>{{ countedItems }}/{{ totalItems }} ({{ progress }}%)</span>
      </div>
      <div class="w-full bg-gray-200 rounded-full h-2">
        <div
          class="bg-blue-600 h-2 rounded-full transition-all"
          :style="{ width: `${progress}%` }"
        ></div>
      </div>
    </div>

    <!-- Main Content -->
    <main class="px-4 py-6">
      <!-- Loading -->
      <div v-if="loading" class="flex justify-center items-center py-12">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>

      <!-- Current Item -->
      <div v-else-if="currentItem" class="space-y-4">
        <!-- Item Info Card -->
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div class="mb-4">
            <h2 class="text-2xl font-bold text-gray-900">{{ currentItem.product?.code }}</h2>
            <p class="text-gray-600">{{ currentItem.product?.name }}</p>
          </div>

          <div class="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p class="text-sm text-gray-600">Localização</p>
              <p class="font-semibold">{{ currentItem.location?.code }}</p>
            </div>
            <div>
              <p class="text-sm text-gray-600">Qtd. Sistema</p>
              <p class="font-semibold text-blue-600">{{ currentItem.systemQty }}</p>
            </div>
          </div>

          <!-- Count Input -->
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Quantidade Contada
            </label>
            <input
              v-model.number="countedQty"
              type="number"
              min="0"
              step="0.01"
              class="w-full text-2xl text-center border-2 border-blue-600 rounded-lg py-3 font-bold"
              placeholder="0"
              autofocus
            />
          </div>

          <!-- Difference Alert -->
          <div v-if="countedQty !== null && countedQty !== currentItem.systemQty" class="mb-4">
            <div :class="[
              'p-4 rounded-lg',
              countedQty < currentItem.systemQty ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'
            ]">
              <p class="text-sm font-medium" :class="countedQty < currentItem.systemQty ? 'text-red-800' : 'text-yellow-800'">
                Divergência: {{ countedQty - currentItem.systemQty > 0 ? '+' : '' }}{{ countedQty - currentItem.systemQty }}
                ({{ ((countedQty - currentItem.systemQty) / currentItem.systemQty * 100).toFixed(1) }}%)
              </p>
            </div>
          </div>

          <!-- Notes -->
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Observações (opcional)
            </label>
            <textarea
              v-model="notes"
              rows="3"
              class="w-full border-gray-300 rounded-md shadow-sm"
              placeholder="Adicione observações sobre a contagem..."
            ></textarea>
          </div>

          <!-- Actions -->
          <div class="flex space-x-3">
            <button
              @click="skipItem"
              class="flex-1 px-4 py-3 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Pular
            </button>
            <button
              @click="submitCount"
              :disabled="countedQty === null"
              class="flex-1 px-4 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Confirmar
            </button>
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="grid grid-cols-3 gap-3">
          <button
            @click="countedQty = 0"
            class="px-4 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Zero
          </button>
          <button
            @click="countedQty = currentItem.systemQty"
            class="px-4 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Sistema
          </button>
          <button
            @click="countedQty = null"
            class="px-4 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Limpar
          </button>
        </div>
      </div>

      <!-- Completed -->
      <div v-else-if="!loading" class="text-center py-12">
        <svg class="mx-auto h-16 w-16 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 class="mt-4 text-lg font-medium text-gray-900">Contagem Concluída!</h3>
        <p class="mt-2 text-sm text-gray-600">Todos os itens foram contados.</p>
        <div class="mt-6 space-x-3">
          <button
            @click="completeSession"
            class="px-6 py-3 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
          >
            Finalizar Sessão
          </button>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useCountingStore } from '@/stores/counting.store';
import AppHeader from '@/components/AppHeader.vue';

const router = useRouter();
const route = useRoute();
const countingStore = useCountingStore();

const loading = ref(false);
const session = ref<any>(null);
const items = ref<any[]>([]);
const currentIndex = ref(0);
const countedQty = ref<number | null>(null);
const notes = ref('');

const currentItem = computed(() => items.value?.[currentIndex.value]);
const totalItems = computed(() => items.value?.length || 0);
const countedItems = computed(() => items.value?.filter(i => i.status === 'COUNTED').length || 0);
const progress = computed(() => totalItems.value > 0 ? Math.round((countedItems.value / totalItems.value) * 100) : 0);

onMounted(async () => {
  await loadSession();
});

const loadSession = async () => {
  try {
    loading.value = true;
    const sessionId = route.params.id as string;
    session.value = await countingStore.fetchSession(sessionId);
    await countingStore.fetchItems({ sessionId });
    
    // Get items from store
    items.value = countingStore.items || [];
    
    // Find first pending item
    const pendingIndex = items.value.findIndex(i => i.status === 'PENDING');
    if (pendingIndex >= 0) {
      currentIndex.value = pendingIndex;
    }
  } catch (error) {
    console.error('Erro ao carregar sessão:', error);
    items.value = []; // Garantir que items nunca seja undefined
  } finally {
    loading.value = false;
  }
};

const submitCount = async () => {
  if (countedQty.value === null || !currentItem.value) return;

  try {
    await countingStore.countItem(currentItem.value.id, {
      countedQty: countedQty.value,
      notes: notes.value || undefined,
    });

    // Move to next pending item
    nextItem();
  } catch (error) {
    console.error('Erro ao registrar contagem:', error);
    alert('Erro ao registrar contagem. Tente novamente.');
  }
};

const skipItem = () => {
  nextItem();
};

const nextItem = () => {
  countedQty.value = null;
  notes.value = '';

  // Find next pending item
  const nextPending = items.value.findIndex((i, idx) => idx > currentIndex.value && i.status === 'PENDING');
  if (nextPending >= 0) {
    currentIndex.value = nextPending;
  } else {
    // No more pending items
    currentIndex.value = items.value.length;
  }
};

const completeSession = async () => {
  try {
    await countingStore.completeSession(route.params.id as string);
    router.push(`/counting/sessions/${route.params.id}/report`);
  } catch (error) {
    console.error('Erro ao finalizar sessão:', error);
    alert('Erro ao finalizar sessão. Tente novamente.');
  }
};
</script>
