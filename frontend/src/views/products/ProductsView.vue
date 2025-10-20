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
            <RouterLink to="/dashboard" class="text-sm text-gray-700 hover:text-primary-600">Dashboard</RouterLink>
            <span class="text-sm text-gray-700">Olá, <span class="font-semibold">{{ authStore.userName }}</span></span>
            <Button variant="outline" size="sm" @click="handleLogout">Sair</Button>
          </div>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="mb-6 flex justify-between items-center">
        <div>
          <h2 class="text-3xl font-bold text-gray-900">Produtos</h2>
          <p class="mt-1 text-sm text-gray-600">Gerencie o catálogo de produtos</p>
        </div>
        <Button @click="openCreateModal"><span class="mr-2">+</span>Novo Produto</Button>
      </div>

      <Card class="mb-6">
        <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div class="md:col-span-2">
            <label class="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
            <input v-model="filters.search" type="text" placeholder="Código ou nome" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" @input="handleFilterChange" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select v-model="filters.type" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" @change="handleFilterChange">
              <option value="">Todos</option>
              <option value="finished">Produto Acabado</option>
              <option value="semi_finished">Semiacabado</option>
              <option value="raw_material">Matéria-prima</option>
              <option value="packaging">Embalagem</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select v-model="filters.active" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" @change="handleFilterChange">
              <option value="">Todos</option>
              <option value="true">Ativos</option>
              <option value="false">Inativos</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
            <input v-model="filters.categoryId" type="text" placeholder="ID da categoria" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" @input="handleFilterChange" />
          </div>
        </div>
      </Card>

      <Card>
        <div v-if="loading" class="text-center py-12"><p class="text-gray-500">Carregando...</p></div>
        <div v-else-if="products.length === 0" class="text-center py-12"><p class="text-gray-500">Nenhum produto encontrado</p></div>
        <div v-else class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unidade</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estoque Mín.</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Custo Padrão</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="product in products" :key="product.id" class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ product.code }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{{ product.name }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ getTypeLabel(product.type) }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ product.unit?.code || '-' }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ product.minStock }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ product.standardCost ? `R$ ${product.standardCost.toFixed(2)}` : '-' }}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span :class="product.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium">
                    {{ product.active ? 'Ativo' : 'Inativo' }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                  <button @click="openEditModal(product)" class="text-primary-600 hover:text-primary-900">Editar</button>
                  <button @click="handleToggleActive(product)" class="text-yellow-600 hover:text-yellow-900">{{ product.active ? 'Desativar' : 'Ativar' }}</button>
                  <button @click="handleDelete(product)" class="text-red-600 hover:text-red-900">Excluir</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </main>

    <div v-if="showModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" @click="closeModal">
      <div class="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" @click.stop>
        <div class="p-6">
          <div class="flex justify-between items-start mb-6">
            <h3 class="text-2xl font-bold text-gray-900">{{ editingProduct ? 'Editar Produto' : 'Novo Produto' }}</h3>
            <button @click="closeModal" class="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
          </div>
          <form @submit.prevent="handleSubmit" class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div><label class="block text-sm font-medium text-gray-700 mb-1">Código *</label><input v-model="formData.code" type="text" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" /></div>
              <div><label class="block text-sm font-medium text-gray-700 mb-1">Nome *</label><input v-model="formData.name" type="text" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" /></div>
            </div>
            <div><label class="block text-sm font-medium text-gray-700 mb-1">Descrição</label><textarea v-model="formData.description" rows="3" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"></textarea></div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
                <select v-model="formData.type" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500">
                  <option value="">Selecione...</option>
                  <option value="finished">Produto Acabado</option>
                  <option value="semi_finished">Semiacabado</option>
                  <option value="raw_material">Matéria-prima</option>
                  <option value="packaging">Embalagem</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Unidade *</label>
                <input v-model="formData.unitId" type="text" required placeholder="ID da unidade" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
              </div>
            </div>
            <div><label class="block text-sm font-medium text-gray-700 mb-1">Categoria</label><input v-model="formData.categoryId" type="text" placeholder="ID da categoria" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" /></div>
            <div class="grid grid-cols-3 gap-4">
              <div><label class="block text-sm font-medium text-gray-700 mb-1">Lead Time (dias)</label><input v-model.number="formData.leadTime" type="number" min="0" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" /></div>
              <div><label class="block text-sm font-medium text-gray-700 mb-1">Lote Econômico</label><input v-model.number="formData.lotSize" type="number" step="0.01" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" /></div>
              <div><label class="block text-sm font-medium text-gray-700 mb-1">Estoque Mínimo</label><input v-model.number="formData.minStock" type="number" step="0.01" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" /></div>
            </div>
            <div class="grid grid-cols-3 gap-4">
              <div><label class="block text-sm font-medium text-gray-700 mb-1">Estoque Máximo</label><input v-model.number="formData.maxStock" type="number" step="0.01" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" /></div>
              <div><label class="block text-sm font-medium text-gray-700 mb-1">Estoque Segurança</label><input v-model.number="formData.safetyStock" type="number" step="0.01" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" /></div>
              <div><label class="block text-sm font-medium text-gray-700 mb-1">Ponto de Pedido</label><input v-model.number="formData.reorderPoint" type="number" step="0.01" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" /></div>
            </div>
            <div class="grid grid-cols-3 gap-4">
              <div><label class="block text-sm font-medium text-gray-700 mb-1">Custo Padrão</label><input v-model.number="formData.standardCost" type="number" step="0.01" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" /></div>
              <div><label class="block text-sm font-medium text-gray-700 mb-1">Último Custo</label><input v-model.number="formData.lastCost" type="number" step="0.01" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" /></div>
              <div><label class="block text-sm font-medium text-gray-700 mb-1">Custo Médio</label><input v-model.number="formData.averageCost" type="number" step="0.01" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" /></div>
            </div>
            <div class="flex items-center"><input v-model="formData.active" type="checkbox" id="active" class="rounded border-gray-300 text-primary-600 focus:ring-primary-500" /><label for="active" class="ml-2 text-sm text-gray-700">Ativo</label></div>
            <div class="flex gap-3 pt-4">
              <Button type="button" variant="outline" @click="closeModal" class="flex-1">Cancelar</Button>
              <Button type="submit" :disabled="loading" class="flex-1">{{ editingProduct ? 'Salvar' : 'Criar' }}</Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import { useProductStore } from '@/stores/product.store';
import type { Product } from '@/services/product.service';
import Button from '@/components/common/Button.vue';
import Card from '@/components/common/Card.vue';

const router = useRouter();
const authStore = useAuthStore();
const productStore = useProductStore();

const products = ref<Product[]>([]);
const loading = ref(false);
const showModal = ref(false);
const editingProduct = ref<Product | null>(null);
const filters = ref({ search: '', type: '', categoryId: '', active: '' });
const pagination = ref({ page: 1, limit: 100, total: 0, pages: 0 });
const formData = ref({
  code: '',
  name: '',
  description: '',
  type: '',
  unitId: '',
  categoryId: '',
  leadTime: 0,
  lotSize: undefined as number | undefined,
  minStock: 0,
  maxStock: undefined as number | undefined,
  safetyStock: 0,
  reorderPoint: undefined as number | undefined,
  standardCost: undefined as number | undefined,
  lastCost: undefined as number | undefined,
  averageCost: undefined as number | undefined,
  active: true,
});

const loadProducts = async () => {
  try {
    loading.value = true;
    const result = await productStore.fetchProducts(
      pagination.value.page,
      pagination.value.limit,
      {
        type: filters.value.type || undefined,
        categoryId: filters.value.categoryId || undefined,
        active: filters.value.active ? filters.value.active === 'true' : undefined,
        search: filters.value.search || undefined,
      }
    );
    products.value = result.data;
    pagination.value = result.pagination;
  } finally {
    loading.value = false;
  }
};

const handleFilterChange = () => {
  pagination.value.page = 1;
  loadProducts();
};

const changePage = (page: number) => {
  pagination.value.page = page;
  loadProducts();
};

const openCreateModal = () => {
  editingProduct.value = null;
  formData.value = {
    code: '',
    name: '',
    description: '',
    type: '',
    unitId: '',
    categoryId: '',
    leadTime: 0,
    lotSize: undefined,
    minStock: 0,
    maxStock: undefined,
    safetyStock: 0,
    reorderPoint: undefined,
    standardCost: undefined,
    lastCost: undefined,
    averageCost: undefined,
    active: true,
  };
  showModal.value = true;
};

const openEditModal = (product: Product) => {
  editingProduct.value = product;
  formData.value = {
    code: product.code,
    name: product.name,
    description: product.description || '',
    type: product.type,
    unitId: product.unitId,
    categoryId: product.categoryId || '',
    leadTime: product.leadTime,
    lotSize: product.lotSize,
    minStock: product.minStock,
    maxStock: product.maxStock,
    safetyStock: product.safetyStock,
    reorderPoint: product.reorderPoint,
    standardCost: product.standardCost,
    lastCost: product.lastCost,
    averageCost: product.averageCost,
    active: product.active,
  };
  showModal.value = true;
};

const closeModal = () => {
  showModal.value = false;
  editingProduct.value = null;
};

const handleSubmit = async () => {
  try {
    const payload = {
      ...formData.value,
      categoryId: formData.value.categoryId || undefined,
      lotSize: formData.value.lotSize ?? undefined,
      maxStock: formData.value.maxStock ?? undefined,
      reorderPoint: formData.value.reorderPoint ?? undefined,
      standardCost: formData.value.standardCost ?? undefined,
      lastCost: formData.value.lastCost ?? undefined,
      averageCost: formData.value.averageCost ?? undefined,
    };
    if (editingProduct.value) {
      await productStore.updateProduct(editingProduct.value.id, payload);
      alert('Produto atualizado com sucesso!');
    } else {
      await productStore.createProduct(payload);
      alert('Produto criado com sucesso!');
    }
    closeModal();
    await loadProducts();
  } catch (error: any) {
    alert(error.response?.data?.message || 'Erro ao salvar produto');
  }
};

const handleToggleActive = async (product: Product) => {
  if (confirm(`Deseja ${product.active ? 'desativar' : 'ativar'} o produto "${product.name}"?`)) {
    try {
      await productStore.toggleActive(product.id);
      await loadProducts();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erro ao alterar status');
    }
  }
};

const handleDelete = async (product: Product) => {
  if (confirm(`Deseja realmente excluir o produto "${product.name}"?`)) {
    try {
      await productStore.deleteProduct(product.id);
      alert('Produto excluído com sucesso!');
      await loadProducts();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erro ao excluir produto');
    }
  }
};

const getTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    finished: 'Produto Acabado',
    semi_finished: 'Semiacabado',
    raw_material: 'Matéria-prima',
    packaging: 'Embalagem',
  };
  return labels[type] || type;
};

const handleLogout = async () => {
  await authStore.logout();
  router.push('/login');
};

onMounted(() => loadProducts());
</script>

