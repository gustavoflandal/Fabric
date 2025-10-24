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
      <div class="mb-6 flex justify-between items-center">
        <div>
          <h2 class="text-3xl font-bold text-gray-900">Estruturas de Armazém</h2>
          <p class="mt-1 text-sm text-gray-600">Gerencie as estruturas dos armazéns do sistema</p>
        </div>
        <Button @click="openCreateModal">
          <span class="mr-2">+</span>
          Nova Estrutura
        </Button>
      </div>

      <Card class="mb-6">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="md:col-span-2">
            <label class="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
            <input
              v-model="filters.search"
              type="text"
              placeholder="Código da rua, nome do armazém..."
              class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              @input="handleFilterChange"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Bloqueada</label>
            <select
              v-model="filters.blocked"
              class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              @change="handleFilterChange"
            >
              <option value="">Todas</option>
              <option value="true">Sim</option>
              <option value="false">Não</option>
            </select>
          </div>
        </div>
      </Card>

      <Card>
        <div v-if="loading" class="text-center py-12">
          <p class="text-gray-500">Carregando...</p>
        </div>

        <div v-else-if="structures.length === 0" class="text-center py-12">
          <p class="text-gray-500">Nenhuma estrutura encontrada</p>
        </div>

        <div v-else class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Código da Rua</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Armazém</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Andares</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Posições</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Posições Geradas</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Capacidade (kg)</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bloqueada</th>
                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="structure in structures" :key="structure.id" class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ structure.streetCode }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{{ structure.warehouse.name }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ structure.floors }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ structure.positions }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <span :class="structure.generatedPositionsCount > 0 ? 'text-green-600 font-semibold' : 'text-gray-400'">
                    {{ structure.generatedPositionsCount || 0 }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ structure.weightCapacity }}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span :class="structure.blocked ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium">
                    {{ structure.blocked ? 'Sim' : 'Não' }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                  <button 
                    v-if="structure.generatedPositionsCount > 0" 
                    @click="openPositionsModal(structure)" 
                    class="text-blue-600 hover:text-blue-900 font-semibold"
                  >
                    Pos
                  </button>
                  <button @click="openEditModal(structure)" class="text-primary-600 hover:text-primary-900">Editar</button>
                  <button @click="handleDelete(structure)" class="text-red-600 hover:text-red-900">Excluir</button>
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
            <h3 class="text-2xl font-bold text-gray-900">{{ editingStructure ? 'Editar Estrutura' : 'Nova Estrutura' }}</h3>
            <button @click="closeModal" class="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
          </div>

          <form @submit.prevent="handleSubmit" class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Código da Rua *</label>
                <input v-model="formData.streetCode" type="text" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Armazém *</label>
                <select v-model="formData.warehouseId" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500">
                  <option v-for="warehouse in warehouses" :value="warehouse.id" :key="warehouse.id">{{ warehouse.name }}</option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-3 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Andares *</label>
                <input v-model="formData.floors" type="text" inputmode="numeric" pattern="[0-9]*" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" @input="e => formData.floors = e.target.value.replace(/[^0-9]/g, '')" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Posições *</label>
                <input v-model="formData.positions" type="text" inputmode="numeric" pattern="[0-9]*" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" @input="e => formData.positions = e.target.value.replace(/[^0-9]/g, '')" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Capacidade de Peso (kg) *</label>
                <input v-model="formData.weightCapacity" type="text" inputmode="decimal" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" @input="e => formData.weightCapacity = e.target.value.replace(/[^0-9.]/g, '')" />
              </div>
            </div>

            <div class="grid grid-cols-3 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Altura (cm) *</label>
                <input v-model="formData.height" type="text" inputmode="decimal" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" @input="e => formData.height = e.target.value.replace(/[^0-9.]/g, '')" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Largura (cm) *</label>
                <input v-model="formData.width" type="text" inputmode="decimal" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" @input="e => formData.width = e.target.value.replace(/[^0-9.]/g, '')" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Profundidade (cm) *</label>
                <input v-model="formData.depth" type="text" inputmode="decimal" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" @input="e => formData.depth = e.target.value.replace(/[^0-9.]/g, '')" />
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Altura Máxima (cm) *</label>
              <input v-model="formData.maxHeight" type="text" inputmode="decimal" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" @input="e => formData.maxHeight = e.target.value.replace(/[^0-9.]/g, '')" />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Tipo de Posição *</label>
              <select v-model="formData.positionType" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500">
                <option v-for="type in positionTypes" :value="type" :key="type">{{ type }}</option>
              </select>
            </div>

            <div class="flex items-center">
              <input v-model="formData.blocked" type="checkbox" id="blocked" class="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
              <label for="blocked" class="ml-2 text-sm text-gray-700">Bloqueada</label>
            </div>

            <!-- Seção de Geração de Posições (apenas no modo de edição) -->
            <div v-if="editingStructure" class="border-t pt-4 mt-4">
              <div class="bg-blue-50 p-4 rounded-lg">
                <h4 class="text-sm font-semibold text-gray-900 mb-2">Geração de Posições</h4>
                <p class="text-sm text-gray-600 mb-3">
                  Gere automaticamente {{ formData.floors }} andares com {{ formData.positions }} posições cada (total: {{ formData.floors * formData.positions }} posições).
                </p>
                <div class="flex gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    @click="handleGeneratePositions"
                    :disabled="generatingPositions"
                    class="flex-1"
                  >
                    {{ generatingPositions ? 'Gerando...' : 'Gerar Posições' }}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    @click="handleDeletePositions"
                    :disabled="deletingPositions"
                    class="flex-1 bg-red-50 hover:bg-red-100 text-red-600"
                  >
                    {{ deletingPositions ? 'Excluindo...' : 'Excluir Posições' }}
                  </Button>
                </div>
                <p v-if="positionsCount !== null" class="text-sm text-gray-600 mt-2">
                  {{ positionsCount }} posições geradas atualmente
                </p>
              </div>
            </div>

            <div class="flex gap-3 pt-4">
              <Button type="button" variant="outline" @click="closeModal" class="flex-1">Cancelar</Button>
              <Button type="submit" :disabled="loading" class="flex-1">{{ editingStructure ? 'Salvar' : 'Criar' }}</Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>

  <!-- Modal de Posições -->
  <div v-if="showPositionsModal" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
      <div class="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
        <h3 class="text-xl font-semibold text-gray-900">
          Posições - {{ selectedStructure?.streetCode }}
        </h3>
        <button @click="closePositionsModal" class="text-gray-400 hover:text-gray-600">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="p-6 overflow-y-auto" style="max-height: calc(90vh - 140px);">
        <div v-if="loadingPositions" class="text-center py-12">
          <p class="text-gray-500">Carregando posições...</p>
        </div>

        <div v-else-if="storagePositions.length === 0" class="text-center py-12">
          <p class="text-gray-500">Nenhuma posição encontrada</p>
        </div>

        <div v-else class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Andar</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Posição</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="position in storagePositions" :key="position.id" class="hover:bg-gray-50">
                <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                  {{ position.code }}
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                  {{ position.floor }}
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                  {{ position.position }}
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                  <span 
                    :class="position.blocked ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'" 
                    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                  >
                    {{ position.blocked ? 'Bloqueada' : 'Disponível' }}
                  </span>
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-right text-sm font-medium space-x-2">
                  <button 
                    @click="toggleBlockPosition(position)" 
                    :class="position.blocked ? 'text-green-600 hover:text-green-900' : 'text-orange-600 hover:text-orange-900'"
                  >
                    {{ position.blocked ? 'Desbloquear' : 'Bloquear' }}
                  </button>
                  <button 
                    @click="deletePosition(position)" 
                    class="text-red-600 hover:text-red-900"
                  >
                    Excluir
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="px-6 py-4 border-t border-gray-200 flex justify-end">
        <Button variant="outline" @click="closePositionsModal">Fechar</Button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import { useWarehouseStructureStore } from '@/stores/warehouse-structure.store';
import { useWarehouseStore } from '@/stores/warehouse.store';
import { storagePositionService } from '@/services/storage-position.service';
import Button from '@/components/common/Button.vue';
import Card from '@/components/common/Card.vue';

const router = useRouter();
const authStore = useAuthStore();
const warehouseStructureStore = useWarehouseStructureStore();
const warehouseStore = useWarehouseStore();

const structures = ref([]);
const warehouses = ref([]);
const loading = ref(false);
const showModal = ref(false);
const editingStructure = ref(null);
const generatingPositions = ref(false);
const deletingPositions = ref(false);
const positionsCount = ref(null);

// Modal de posições
const showPositionsModal = ref(false);
const selectedStructure = ref(null);
const storagePositions = ref([]);
const loadingPositions = ref(false);

const filters = ref({ search: '', blocked: '' });
const pagination = ref({ page: 1, limit: 100, total: 0, pages: 0 });

const formData = ref({
  streetCode: '',
  warehouseId: '',
  floors: '',
  positions: '',
  weightCapacity: '',
  height: '',
  width: '',
  depth: '',
  maxHeight: '',
  positionType: '',
  blocked: false,
});

const positionTypes = [
  'PORTA_PALETES',
  'MINI_PORTA_PALETES',
  'DRIVE_IN',
  'DRIVE_THROUGH',
  'PUSH_BACK',
  'FLOW_RACK',
  'CANTILEVER',
  'MEZANINO',
  'AUTOPORTANTE',
  'RACKS',
  'CARROSSEL',
  'MINI_LOAD',
  'ESTANTES_INDUSTRIAIS',
];

const loadStructures = async () => {
  try {
    loading.value = true;
    const result = await warehouseStructureStore.fetchStructures(pagination.value.page, pagination.value.limit, filters.value);
    structures.value = result.data;
    pagination.value = result.pagination;
  } finally {
    loading.value = false;
  }
};

const loadWarehouses = async () => {
  await warehouseStore.fetchWarehouses();
  warehouses.value = warehouseStore.warehouses;
};

const handleFilterChange = () => {
  pagination.value.page = 1;
  loadStructures();
};

const openCreateModal = () => {
  editingStructure.value = null;
  formData.value = {
    streetCode: '',
    warehouseId: '',
    floors: '',
    positions: '',
    weightCapacity: '',
    height: '',
    width: '',
    depth: '',
    maxHeight: '',
    positionType: '',
    blocked: false,
  };
  showModal.value = true;
};

const openEditModal = async (structure) => {
  editingStructure.value = structure;
  formData.value = { ...structure };
  showModal.value = true;
  
  // Carregar contagem de posições
  await loadPositionsCount(structure.id);
};

const closeModal = () => {
  showModal.value = false;
  editingStructure.value = null;
  positionsCount.value = null;
};

const loadPositionsCount = async (structureId) => {
  try {
    const response = await storagePositionService.getPositions(structureId);
    positionsCount.value = response.data.length;
  } catch (error) {
    console.error('Erro ao carregar posições:', error);
    positionsCount.value = 0;
  }
};

const handleGeneratePositions = async () => {
  if (!editingStructure.value) return;
  
  if (!confirm(`Deseja gerar ${formData.value.floors * formData.value.positions} posições para esta estrutura?`)) {
    return;
  }
  
  try {
    generatingPositions.value = true;
    const response = await storagePositionService.generatePositions(editingStructure.value.id);
    alert(response.message);
    await loadPositionsCount(editingStructure.value.id);
    await loadStructures(); // Recarregar lista para atualizar contagem
  } catch (error) {
    alert(error.response?.data?.message || 'Erro ao gerar posições');
  } finally {
    generatingPositions.value = false;
  }
};
const handleDeletePositions = async () => {
  if (!editingStructure.value) return;
  
  if (!confirm('Deseja realmente excluir todas as posições desta estrutura? Esta ação não pode ser desfeita.')) {
    return;
  }
  
  try {
    deletingPositions.value = true;
    const response = await storagePositionService.deletePositions(editingStructure.value.id);
    alert(response.message);
    await loadPositionsCount(editingStructure.value.id);
    await loadStructures(); // Recarregar lista para atualizar contagem
  } catch (error) {
    alert(error.response?.data?.message || 'Erro ao excluir posições');
  } finally {
    deletingPositions.value = false;
  }
};

const handleSubmit = async () => {
  try {
    const submitData = {
      ...formData.value,
      floors: Number(formData.value.floors),
      positions: Number(formData.value.positions),
      weightCapacity: Number(formData.value.weightCapacity),
      height: Number(formData.value.height),
      width: Number(formData.value.width),
      depth: Number(formData.value.depth),
      maxHeight: Number(formData.value.maxHeight),
    };
    
    if (editingStructure.value) {
      await warehouseStructureStore.updateStructure(editingStructure.value.id, submitData);
      alert('Estrutura atualizada com sucesso!');
    } else {
      await warehouseStructureStore.createStructure(submitData);
      alert('Estrutura criada com sucesso!');
    }
    closeModal();
    await loadStructures();
  } catch (error) {
    alert(error.response?.data?.message || 'Erro ao salvar estrutura');
  }
};

const handleDelete = async (structure) => {
  if (confirm(`Deseja realmente excluir a estrutura "${structure.streetCode}"?`)) {
    try {
      await warehouseStructureStore.deleteStructure(structure.id);
      alert('Estrutura excluída com sucesso!');
      await loadStructures();
    } catch (error) {
      alert(error.response?.data?.message || 'Erro ao excluir estrutura');
    }
  }
};

const handleLogout = async () => {
  await authStore.logout();
  router.push('/login');
};

// Funções do modal de posições
const openPositionsModal = async (structure) => {
  selectedStructure.value = structure;
  showPositionsModal.value = true;
  await loadStoragePositions(structure.id);
};

const closePositionsModal = () => {
  showPositionsModal.value = false;
  selectedStructure.value = null;
  storagePositions.value = [];
};

const loadStoragePositions = async (structureId) => {
  try {
    loadingPositions.value = true;
    const response = await storagePositionService.getPositions(structureId);
    storagePositions.value = response.data;
  } catch (error) {
    console.error('Erro ao carregar posições:', error);
    alert('Erro ao carregar posições');
  } finally {
    loadingPositions.value = false;
  }
};

const toggleBlockPosition = async (position) => {
  try {
    await storagePositionService.updatePosition(position.id, {
      blocked: !position.blocked
    });
    
    // Atualizar localmente
    position.blocked = !position.blocked;
    
    alert(`Posição ${position.blocked ? 'bloqueada' : 'desbloqueada'} com sucesso!`);
  } catch (error) {
    console.error('Erro ao atualizar posição:', error);
    alert('Erro ao atualizar posição');
  }
};

const deletePosition = async (position) => {
  if (!confirm(`Deseja realmente excluir a posição "${position.code}"?`)) {
    return;
  }
  
  try {
    await storagePositionService.deletePosition(position.id);
    
    // Remover da lista local
    storagePositions.value = storagePositions.value.filter(p => p.id !== position.id);
    
    // Atualizar contagem no grid principal
    await loadStructures();
    
    alert('Posição excluída com sucesso!');
  } catch (error) {
    console.error('Erro ao excluir posição:', error);
    alert('Erro ao excluir posição');
  }
};

onMounted(() => {
  loadStructures();
  loadWarehouses();
});
</script>