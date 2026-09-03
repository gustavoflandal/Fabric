<template>
  <AppLayout title="Produtos" subtitle="Gerencie o catálogo de produtos">
    <template #actions>
      <Button @click="openCreateModal"><span class="mr-2">+</span>Novo Produto</Button>
    </template>

    <Card class="mb-6">
      <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
        <FormField id="prod-filter-search" label="Buscar" class="md:col-span-2">
          <input
            v-model="filters.search"
            type="text"
            placeholder="Código ou nome"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            @input="debouncedFilterChange"
          />
        </FormField>
        <FormField id="prod-filter-type" label="Tipo">
          <select
            v-model="filters.type"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            @change="handleFilterChange"
          >
            <option value="">Todos</option>
            <option value="finished">Produto Acabado</option>
            <option value="semi_finished">Semiacabado</option>
            <option value="raw_material">Matéria-prima</option>
            <option value="packaging">Embalagem</option>
          </select>
        </FormField>
        <FormField id="prod-filter-active" label="Status">
          <select
            v-model="filters.active"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            @change="handleFilterChange"
          >
            <option value="">Todos</option>
            <option value="true">Ativos</option>
            <option value="false">Inativos</option>
          </select>
        </FormField>
        <FormField id="prod-filter-category" label="Categoria">
          <input
            v-model="filters.categoryId"
            type="text"
            placeholder="ID da categoria"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            @input="debouncedFilterChange"
          />
        </FormField>
      </div>
    </Card>

    <DataTable
      :loading="loading"
      :error="error"
      :items="products"
      :pagination="pagination"
      empty-title="Nenhum produto encontrado"
      empty-hint="Ajuste os filtros ou cadastre um novo produto."
      @retry="loadProducts"
      @change-page="changePage"
    >
      <template #empty-action>
        <Button @click="openCreateModal"><span class="mr-2">+</span>Novo Produto</Button>
      </template>

      <template #head>
        <th scope="col" class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Código</th>
        <th scope="col" class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
        <th scope="col" class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Tipo</th>
        <th scope="col" class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Unidade</th>
        <th scope="col" class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">Estoque Mín.</th>
        <th scope="col" class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Custo Padrão</th>
        <th scope="col" class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Status</th>
        <th scope="col" class="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-80">Ações</th>
      </template>

      <template #row="{ item }">
        <td class="px-3 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{{ item.code }}</td>
        <td class="px-3 py-3 text-sm text-gray-900">{{ item.name }}</td>
        <td class="px-3 py-3 whitespace-nowrap text-sm text-gray-500">{{ getTypeLabel(item.type) }}</td>
        <td class="px-3 py-3 whitespace-nowrap text-sm text-gray-500">{{ item.unit?.code || '-' }}</td>
        <td class="px-3 py-3 whitespace-nowrap text-sm text-gray-500">{{ item.minStock }}</td>
        <td class="px-3 py-3 whitespace-nowrap text-sm text-gray-500">{{ formatCost(item.standardCost) }}</td>
        <td class="px-3 py-3 whitespace-nowrap">
          <StatusBadge
            :label="item.active ? 'Ativo' : 'Inativo'"
            :tone="item.active ? 'success' : 'danger'"
          />
        </td>
        <td class="px-3 py-3 whitespace-nowrap text-right text-sm font-medium">
          <div class="flex items-center justify-end space-x-3">
            <button @click="openEditModal(item)" class="text-primary-600 hover:text-primary-900">Editar</button>
            <button @click="openBomManager(item)" class="text-primary-600 hover:text-primary-900">BOMs</button>
            <button @click="openRoutingManager(item)" class="text-primary-600 hover:text-primary-900">Roteiros</button>
            <button @click="handleToggleActive(item)" class="text-yellow-600 hover:text-yellow-900">
              {{ item.active ? 'Desativar' : 'Ativar' }}
            </button>
            <button @click="handleDelete(item)" class="text-red-600 hover:text-red-900">Excluir</button>
          </div>
        </td>
      </template>
    </DataTable>

    <BomManagerModal v-model="showBomModal" :product="selectedProduct" />
    <RoutingManagerModal v-model="showRoutingModal" :product="selectedProduct" />

    <AppModal
      v-model="showModal"
      :title="editingProduct ? 'Editar Produto' : 'Novo Produto'"
      @close="closeModal"
    >
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <!-- Identificação -->
        <div class="grid grid-cols-2 gap-4">
          <FormField id="prod-form-code" label="Código" required>
            <input v-model="formData.code" type="text" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
          </FormField>
          <FormField id="prod-form-name" label="Nome" required>
            <input v-model="formData.name" type="text" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
          </FormField>
        </div>

        <FormField id="prod-form-description" label="Descrição">
          <textarea v-model="formData.description" rows="3" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"></textarea>
        </FormField>

        <!-- Classificação — mesma delimitação de seção do precedente de
             WarehouseStructuresView (§5.2): `border-t pt-4 mt-4` + h4. -->
        <div class="border-t pt-4 mt-4 space-y-4">
          <h4 class="text-sm font-semibold text-gray-900">Classificação</h4>

          <div class="grid grid-cols-2 gap-4">
            <FormField id="prod-form-type" label="Tipo" required>
              <select v-model="formData.type" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500">
                <option value="">Selecione...</option>
                <option value="finished">Produto Acabado</option>
                <option value="semi_finished">Semiacabado</option>
                <option value="raw_material">Matéria-prima</option>
                <option value="packaging">Embalagem</option>
              </select>
            </FormField>
            <FormField id="prod-form-unit" label="Unidade" required>
              <select v-model="formData.unitId" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500">
                <option value="">Selecione...</option>
                <option v-for="unit in unitStore.units" :key="unit.id" :value="unit.id">
                  {{ unit.code }} - {{ unit.name }}
                </option>
              </select>
            </FormField>
          </div>

          <FormField id="prod-form-category" label="Categoria">
            <select v-model="formData.categoryId" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500">
              <option value="">Nenhuma</option>
              <option v-for="category in categoryStore.categories" :key="category.id" :value="category.id">
                {{ category.code }} - {{ category.name }}
              </option>
            </select>
          </FormField>
        </div>

        <!-- Planejamento -->
        <div class="border-t pt-4 mt-4 space-y-4">
          <h4 class="text-sm font-semibold text-gray-900">Planejamento</h4>

          <div class="grid grid-cols-2 gap-4">
            <FormField id="prod-form-lead-time" label="Lead Time (dias)">
              <input v-model.number="formData.leadTime" type="number" min="0" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
            </FormField>
            <FormField id="prod-form-lot-size" label="Lote Econômico">
              <input v-model.number="formData.lotSize" type="number" step="0.01" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
            </FormField>
          </div>
        </div>

        <!-- Níveis de estoque -->
        <div class="border-t pt-4 mt-4 space-y-4">
          <h4 class="text-sm font-semibold text-gray-900">Níveis de Estoque</h4>

          <div class="grid grid-cols-2 gap-4">
            <FormField id="prod-form-min-stock" label="Estoque Mínimo">
              <input v-model.number="formData.minStock" type="number" step="0.01" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
            </FormField>
            <FormField id="prod-form-max-stock" label="Estoque Máximo">
              <input v-model.number="formData.maxStock" type="number" step="0.01" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
            </FormField>
            <FormField id="prod-form-safety-stock" label="Estoque Segurança">
              <input v-model.number="formData.safetyStock" type="number" step="0.01" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
            </FormField>
            <FormField id="prod-form-reorder-point" label="Ponto de Pedido">
              <input v-model.number="formData.reorderPoint" type="number" step="0.01" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
            </FormField>
          </div>
        </div>

        <!-- Custos -->
        <div class="border-t pt-4 mt-4 space-y-4">
          <h4 class="text-sm font-semibold text-gray-900">Custos</h4>

          <div class="grid grid-cols-3 gap-4">
            <FormField id="prod-form-standard-cost" label="Custo Padrão">
              <input v-model.number="formData.standardCost" type="number" step="0.01" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
            </FormField>
            <FormField id="prod-form-last-cost" label="Último Custo">
              <input v-model.number="formData.lastCost" type="number" step="0.01" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
            </FormField>
            <FormField id="prod-form-average-cost" label="Custo Médio">
              <input v-model.number="formData.averageCost" type="number" step="0.01" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
            </FormField>
          </div>
        </div>

        <div class="flex items-center border-t pt-4 mt-4">
          <input v-model="formData.active" type="checkbox" id="prod-form-active" class="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
          <label for="prod-form-active" class="ml-2 text-sm text-gray-700">Ativo</label>
        </div>

        <div class="flex gap-3 pt-4">
          <Button type="button" variant="outline" @click="closeModal" class="flex-1">Cancelar</Button>
          <Button type="submit" :disabled="saving" class="flex-1">{{ editingProduct ? 'Salvar' : 'Criar' }}</Button>
        </div>
      </form>
    </AppModal>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useProductStore } from '@/stores/product.store';
import { useUnitOfMeasureStore } from '@/stores/unit-of-measure.store';
import { useProductCategoryStore } from '@/stores/product-category.store';
import type { Product } from '@/services/product.service';
import AppLayout from '@/components/common/AppLayout.vue';
import AppModal from '@/components/common/AppModal.vue';
import Button from '@/components/common/Button.vue';
import Card from '@/components/common/Card.vue';
import DataTable from '@/components/common/DataTable.vue';
import FormField from '@/components/common/FormField.vue';
import StatusBadge from '@/components/common/StatusBadge.vue';
import BomManagerModal from '@/components/products/BomManagerModal.vue';
import RoutingManagerModal from '@/components/products/RoutingManagerModal.vue';
import { useToast } from '@/composables/useToast';
import { confirmDialog } from '@/composables/useConfirm';
import { useDebounce } from '@/composables/useDebounce';

const productStore = useProductStore();
const unitStore = useUnitOfMeasureStore();
const categoryStore = useProductCategoryStore();
const toast = useToast();

const products = ref<Product[]>([]);
const loading = ref(false);
// §4.4-5 / I11: erro de carregamento e um estado proprio, nunca "lista vazia".
const error = ref('');
const saving = ref(false);
const showModal = ref(false);
const showBomModal = ref(false);
const showRoutingModal = ref(false);
const editingProduct = ref<Product | null>(null);
const selectedProduct = ref<Product | null>(null);
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
    error.value = '';
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
  } catch (e: any) {
    error.value = e.response?.data?.message || 'Erro ao carregar produtos';
  } finally {
    loading.value = false;
  }
};

const handleFilterChange = () => {
  pagination.value.page = 1;
  loadProducts();
};
const debouncedFilterChange = useDebounce(handleFilterChange, 350);

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

// Esc, focus trap e devolucao de foco agora vem do AppModal (§4.2).
const closeModal = () => {
  showModal.value = false;
  editingProduct.value = null;
};

const openBomManager = (product: Product) => {
  selectedProduct.value = product;
  showBomModal.value = true;
};

const openRoutingManager = (product: Product) => {
  selectedProduct.value = product;
  showRoutingModal.value = true;
};

watch(products, (list) => {
  if (!selectedProduct.value) return;
  const updated = list.find((item) => item.id === selectedProduct.value?.id);
  if (updated) {
    selectedProduct.value = updated;
  }
});

const handleSubmit = async () => {
  try {
    saving.value = true;
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
      toast.success('Produto atualizado com sucesso!');
    } else {
      await productStore.createProduct(payload);
      toast.success('Produto criado com sucesso!');
    }

    closeModal();
    await loadProducts();
  } catch (error: any) {
    toast.error(error.response?.data?.message || 'Erro ao salvar produto');
  } finally {
    saving.value = false;
  }
};

const handleToggleActive = async (product: Product) => {
  if (!(await confirmDialog(`Deseja ${product.active ? 'desativar' : 'ativar'} o produto "${product.name}"?`))) {
    return;
  }
  try {
    await productStore.toggleActive(product.id);
    await loadProducts();
  } catch (error: any) {
    toast.error(error.response?.data?.message || 'Erro ao alterar status');
  }
};

const handleDelete = async (product: Product) => {
  if (!(await confirmDialog(`Deseja realmente excluir o produto "${product.name}"?`))) {
    return;
  }
  try {
    await productStore.deleteProduct(product.id);
    toast.success('Produto excluído com sucesso!');
    await loadProducts();
  } catch (error: any) {
    toast.error(error.response?.data?.message || 'Erro ao excluir produto');
  }
};

const formatCost = (value?: number) => (value ? `R$ ${value.toFixed(2)}` : '-');

const getTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    finished: 'Produto Acabado',
    semi_finished: 'Semiacabado',
    raw_material: 'Matéria-prima',
    packaging: 'Embalagem',
  };
  return labels[type] || type;
};

onMounted(async () => {
  await Promise.all([
    unitStore.fetchUnits(1, 1000, { active: true }),
    categoryStore.fetchCategories(),
  ]);
  await loadProducts();
});
</script>
