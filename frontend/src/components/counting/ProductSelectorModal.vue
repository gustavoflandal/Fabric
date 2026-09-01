<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 overflow-y-auto">
    <div class="flex items-center justify-center min-h-screen px-4">
      <div class="fixed inset-0 bg-black opacity-30" @click="$emit('close')"></div>
      
      <div class="relative bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
        <div class="flex justify-between items-start mb-4">
          <h3 class="text-xl font-semibold text-gray-900">Selecionar Produtos</h3>
          <button @click="$emit('close')" class="text-gray-500 hover:text-gray-700">
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <!-- Search -->
        <div class="mb-4">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Buscar produtos..."
            class="w-full border-gray-300 rounded-md shadow-sm"
          />
        </div>
        
        <!-- Product List -->
        <div class="max-h-96 overflow-y-auto mb-4">
          <div v-if="loading" class="text-center py-8">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </div>
          <div v-else-if="filteredProducts.length === 0" class="text-center py-8 text-gray-500">
            Nenhum produto encontrado
          </div>
          <ul v-else class="divide-y divide-gray-200">
            <li v-for="product in filteredProducts" :key="product.id" class="py-3 flex items-center justify-between">
              <div>
                <div class="font-medium text-gray-900">{{ product.name }}</div>
                <div class="text-sm text-gray-500">{{ product.code }}</div>
              </div>
              <button
                @click="toggleProduct(product)"
                :class="[
                  'px-3 py-1 rounded-full text-sm font-medium',
                  isSelected(product.id) ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                ]"
              >
                {{ isSelected(product.id) ? 'Selecionado' : 'Selecionar' }}
              </button>
            </li>
          </ul>
        </div>
        
        <!-- Actions -->
        <div class="flex justify-end space-x-3 pt-4 border-t border-gray-200">
          <button
            @click="$emit('close')"
            class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            @click="confirmSelection"
            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Confirmar ({{ selectedProducts.length }} produtos)
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import axios from 'axios';
import { useAuthStore } from '@/stores/auth.store';

const props = defineProps<{
  isOpen: boolean;
  initialSelection?: string[];
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'select', products: any[]): void;
}>();

const loading = ref(false);
const searchQuery = ref('');
const products = ref<any[]>([]);
const selectedProducts = ref<any[]>([]);

const filteredProducts = computed(() => {
  if (!searchQuery.value) return products.value;
  const query = searchQuery.value.toLowerCase();
  return products.value.filter(p => 
    p.name.toLowerCase().includes(query) || 
    p.code.toLowerCase().includes(query)
  );
});

const isSelected = (productId: string) => {
  return selectedProducts.value.some(p => p.id === productId);
};

const toggleProduct = (product: any) => {
  const index = selectedProducts.value.findIndex(p => p.id === product.id);
  if (index >= 0) {
    selectedProducts.value.splice(index, 1);
  } else {
    selectedProducts.value.push(product);
  }
};

const confirmSelection = () => {
  emit('select', selectedProducts.value);
  emit('close');
};

const loadProducts = async () => {
  try {
    loading.value = true;
    const authStore = useAuthStore();
    const response = await axios.get('/api/v1/products', {
      headers: {
        'Authorization': `Bearer ${authStore.accessToken}`
      }
    });
    products.value = response.data.data || response.data;
  } catch (error) {
    console.error('Erro ao carregar produtos:', error);
    alert('Erro ao carregar produtos. Verifique o console.');
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadProducts();
  if (props.initialSelection) {
    // Load initially selected products
  }
});
</script>
