<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <header class="bg-white shadow-sm border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
          <div class="flex items-center">
            <img src="/logo.png" alt="Fabric" class="h-10 w-auto" />
            <h1 class="ml-4 text-2xl font-bold text-primary-800">Fabric</h1>
          </div>
          
          <div class="flex items-center space-x-4">
            <RouterLink to="/dashboard" class="text-sm text-gray-700 hover:text-primary-600">
              Dashboard
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

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Page Header -->
      <div class="mb-6 flex justify-between items-center">
        <div>
          <h2 class="text-3xl font-bold text-gray-900">Unidades de Medida</h2>
          <p class="mt-1 text-sm text-gray-600">
            Gerencie as unidades de medida do sistema
          </p>
        </div>
        <Button @click="openCreateModal">
          <span class="mr-2">+</span>
          Nova Unidade
        </Button>
      </div>

      <!-- Filters -->
      <Card class="mb-6">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
            <input
              v-model="filters.search"
              type="text"
              placeholder="Código, nome ou símbolo..."
              class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              @input="handleFilterChange"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select
              v-model="filters.type"
              class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              @change="handleFilterChange"
            >
              <option value="">Todos</option>
              <option value="length">Comprimento</option>
              <option value="weight">Peso</option>
              <option value="volume">Volume</option>
              <option value="quantity">Quantidade</option>
              <option value="time">Tempo</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              v-model="filters.active"
              class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              @change="handleFilterChange"
            >
              <option value="">Todos</option>
              <option value="true">Ativos</option>
              <option value="false">Inativos</option>
            </select>
          </div>

          <div class="flex items-end">
            <Button variant="outline" @click="clearFilters" class="w-full">
              Limpar Filtros
            </Button>
          </div>
        </div>
      </Card>

      <!-- Table -->
      <Card>
        <div v-if="loading" class="text-center py-12">
          <p class="text-gray-500">Carregando...</p>
        </div>

        <div v-else-if="units.length === 0" class="text-center py-12">
          <p class="text-gray-500">Nenhuma unidade de medida encontrada</p>
        </div>

        <div v-else class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Código
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nome
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipo
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Símbolo
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="unit in units" :key="unit.id" class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {{ unit.code }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {{ unit.name }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ getTypeLabel(unit.type) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ unit.symbol || '-' }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span
                    :class="unit.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'"
                    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                  >
                    {{ unit.active ? 'Ativo' : 'Inativo' }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                  <button
                    @click="openEditModal(unit)"
                    class="text-primary-600 hover:text-primary-900"
                  >
                    Editar
                  </button>
                  <button
                    @click="handleToggleActive(unit)"
                    class="text-yellow-600 hover:text-yellow-900"
                  >
                    {{ unit.active ? 'Desativar' : 'Ativar' }}
                  </button>
                  <button
                    @click="handleDelete(unit)"
                    class="text-red-600 hover:text-red-900"
                  >
                    Excluir
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div v-if="pagination.pages > 1" class="px-6 py-4 border-t border-gray-200">
          <div class="flex items-center justify-between">
            <div class="text-sm text-gray-700">
              Mostrando {{ (pagination.page - 1) * pagination.limit + 1 }} a 
              {{ Math.min(pagination.page * pagination.limit, pagination.total) }} de 
              {{ pagination.total }} resultados
            </div>
            <div class="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                :disabled="pagination.page === 1"
                @click="changePage(pagination.page - 1)"
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                :disabled="pagination.page === pagination.pages"
                @click="changePage(pagination.page + 1)"
              >
                Próxima
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </main>

    <!-- Modal Create/Edit -->
    <div
      v-if="showModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click="closeModal"
    >
      <div
        class="bg-white rounded-lg max-w-md w-full mx-4"
        @click.stop
      >
        <div class="p-6">
          <div class="flex justify-between items-start mb-6">
            <h3 class="text-2xl font-bold text-gray-900">
              {{ editingUnit ? 'Editar Unidade' : 'Nova Unidade' }}
            </h3>
            <button
              @click="closeModal"
              class="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ✕
            </button>
          </div>

          <form @submit.prevent="handleSubmit" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Código *
              </label>
              <input
                v-model="formData.code"
                type="text"
                required
                class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                placeholder="Ex: UN, KG, M"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Nome *
              </label>
              <input
                v-model="formData.name"
                type="text"
                required
                class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                placeholder="Ex: Unidade, Quilograma, Metro"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Tipo *
              </label>
              <select
                v-model="formData.type"
                required
                class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              >
                <option value="">Selecione...</option>
                <option value="length">Comprimento</option>
                <option value="weight">Peso</option>
                <option value="volume">Volume</option>
                <option value="quantity">Quantidade</option>
                <option value="time">Tempo</option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Símbolo
              </label>
              <input
                v-model="formData.symbol"
                type="text"
                class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                placeholder="Ex: un, kg, m"
              />
            </div>

            <div class="flex items-center">
              <input
                v-model="formData.active"
                type="checkbox"
                id="active"
                class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <label for="active" class="ml-2 text-sm text-gray-700">
                Ativo
              </label>
            </div>

            <div class="flex gap-3 pt-4">
              <Button type="button" variant="outline" @click="closeModal" class="flex-1">
                Cancelar
              </Button>
              <Button type="submit" :disabled="loading" class="flex-1">
                {{ editingUnit ? 'Salvar' : 'Criar' }}
              </Button>
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
import { useUnitOfMeasureStore } from '@/stores/unit-of-measure.store';
import type { UnitOfMeasure } from '@/services/unit-of-measure.service';
import Button from '@/components/common/Button.vue';
import Card from '@/components/common/Card.vue';

const router = useRouter();
const authStore = useAuthStore();
const unitStore = useUnitOfMeasureStore();

const units = ref<UnitOfMeasure[]>([]);
const loading = ref(false);
const showModal = ref(false);
const editingUnit = ref<UnitOfMeasure | null>(null);

const filters = ref({
  search: '',
  type: '',
  active: '',
});

const pagination = ref({
  page: 1,
  limit: 100,
  total: 0,
  pages: 0,
});

const formData = ref({
  code: '',
  name: '',
  type: '',
  symbol: '',
  active: true,
});

const loadUnits = async () => {
  try {
    loading.value = true;
    const result = await unitStore.fetchUnits(
      pagination.value.page,
      pagination.value.limit,
      {
        type: filters.value.type || undefined,
        active: filters.value.active ? filters.value.active === 'true' : undefined,
        search: filters.value.search || undefined,
      }
    );
    units.value = result.data;
    pagination.value = result.pagination;
  } catch (error) {
    console.error('Erro ao carregar unidades:', error);
  } finally {
    loading.value = false;
  }
};

const handleFilterChange = () => {
  pagination.value.page = 1;
  loadUnits();
};

const clearFilters = () => {
  filters.value = {
    search: '',
    type: '',
    active: '',
  };
  handleFilterChange();
};

const changePage = (page: number) => {
  pagination.value.page = page;
  loadUnits();
};

const openCreateModal = () => {
  editingUnit.value = null;
  formData.value = {
    code: '',
    name: '',
    type: '',
    symbol: '',
    active: true,
  };
  showModal.value = true;
};

const openEditModal = (unit: UnitOfMeasure) => {
  editingUnit.value = unit;
  formData.value = {
    code: unit.code,
    name: unit.name,
    type: unit.type,
    symbol: unit.symbol || '',
    active: unit.active,
  };
  showModal.value = true;
};

const closeModal = () => {
  showModal.value = false;
  editingUnit.value = null;
};

const handleSubmit = async () => {
  try {
    if (editingUnit.value) {
      await unitStore.updateUnit(editingUnit.value.id, formData.value);
      alert('Unidade atualizada com sucesso!');
    } else {
      await unitStore.createUnit(formData.value);
      alert('Unidade criada com sucesso!');
    }
    closeModal();
    await loadUnits();
  } catch (error: any) {
    alert(error.response?.data?.message || 'Erro ao salvar unidade');
  }
};

const handleToggleActive = async (unit: UnitOfMeasure) => {
  if (confirm(`Deseja ${unit.active ? 'desativar' : 'ativar'} a unidade "${unit.name}"?`)) {
    try {
      await unitStore.toggleActive(unit.id);
      await loadUnits();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erro ao alterar status');
    }
  }
};

const handleDelete = async (unit: UnitOfMeasure) => {
  if (confirm(`Deseja realmente excluir a unidade "${unit.name}"?\n\nEsta ação não pode ser desfeita.`)) {
    try {
      await unitStore.deleteUnit(unit.id);
      alert('Unidade excluída com sucesso!');
      await loadUnits();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erro ao excluir unidade');
    }
  }
};

const getTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    length: 'Comprimento',
    weight: 'Peso',
    volume: 'Volume',
    quantity: 'Quantidade',
    time: 'Tempo',
  };
  return labels[type] || type;
};

const handleLogout = async () => {
  await authStore.logout();
  router.push('/login');
};

onMounted(() => {
  loadUnits();
});
</script>
