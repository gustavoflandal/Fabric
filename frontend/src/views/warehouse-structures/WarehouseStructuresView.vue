<template>
  <AppLayout title="Estruturas de Armazém" subtitle="Gerencie as estruturas dos armazéns do sistema">
    <template #actions>
      <Button @click="openCreateModal"><span class="mr-2">+</span>Nova Estrutura</Button>
    </template>

    <Card class="mb-6">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormField id="ws-filter-search" label="Buscar" class="md:col-span-2">
          <input
            v-model="filters.search"
            type="text"
            placeholder="Código da rua, nome do armazém..."
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            @input="debouncedFilterChange"
          />
        </FormField>
        <FormField id="ws-filter-blocked" label="Bloqueada">
          <select
            v-model="filters.blocked"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            @change="handleFilterChange"
          >
            <option value="">Todas</option>
            <option value="true">Sim</option>
            <option value="false">Não</option>
          </select>
        </FormField>
      </div>
    </Card>

    <DataTable
      :loading="loading"
      :error="error"
      :items="structures"
      :pagination="pagination"
      empty-title="Nenhuma estrutura encontrada"
      empty-hint="Ajuste os filtros ou cadastre uma nova estrutura."
      @retry="loadStructures"
      @change-page="changePage"
    >
      <template #empty-action>
        <Button @click="openCreateModal"><span class="mr-2">+</span>Nova Estrutura</Button>
      </template>

      <template #head>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código da Rua</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Armazém</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Andares</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Posições</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Posições Geradas</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Capacidade (kg)</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bloqueada</th>
        <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
      </template>

      <template #row="{ item }">
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ item.streetCode }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{{ item.warehouse?.name }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ item.floors }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ item.positions }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          <span :class="(item.generatedPositionsCount ?? 0) > 0 ? 'text-green-600 font-semibold' : 'text-gray-400'">
            {{ item.generatedPositionsCount || 0 }}
          </span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ item.weightCapacity }}</td>
        <td class="px-6 py-4 whitespace-nowrap">
          <StatusBadge
            :label="item.blocked ? 'Sim' : 'Não'"
            :tone="item.blocked ? 'danger' : 'success'"
          />
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
          <button
            v-if="(item.generatedPositionsCount ?? 0) > 0"
            @click="openPositionsModal(item)"
            class="text-primary-600 hover:text-primary-900"
          >
            Pos
          </button>
          <button
            @click="openEditModal(item)"
            :disabled="(item.generatedPositionsCount ?? 0) > 0"
            :class="[
              (item.generatedPositionsCount ?? 0) > 0
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-primary-600 hover:text-primary-900'
            ]"
            :title="(item.generatedPositionsCount ?? 0) > 0 ? 'Excluir as posições antes de editar' : 'Editar estrutura'"
          >
            Editar
          </button>
          <button
            @click="handleDelete(item)"
            :disabled="(item.generatedPositionsCount ?? 0) > 0"
            :class="[
              (item.generatedPositionsCount ?? 0) > 0
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-red-600 hover:text-red-900'
            ]"
            :title="(item.generatedPositionsCount ?? 0) > 0 ? 'Excluir as posições antes de excluir a estrutura' : 'Excluir estrutura'"
          >
            Excluir
          </button>
        </td>
      </template>
    </DataTable>

    <!-- Formulário da estrutura -->
    <AppModal
      v-model="showModal"
      :title="editingStructure ? 'Editar Estrutura' : 'Nova Estrutura'"
      @close="closeModal"
    >
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <FormField id="ws-form-street-code" label="Código da Rua" required>
            <input v-model="formData.streetCode" type="text" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
          </FormField>
          <FormField id="ws-form-warehouse" label="Armazém" required>
            <select v-model="formData.warehouseId" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500">
              <option v-for="warehouse in warehouses" :value="warehouse.id" :key="warehouse.id">{{ warehouse.name }}</option>
            </select>
          </FormField>
        </div>

        <!-- Sanitizacao inline dos campos numericos preservada como estava
             (o modelo aceita string e so converte com Number() no submit). -->
        <div class="grid grid-cols-3 gap-4">
          <FormField id="ws-form-floors" label="Andares" required>
            <input v-model="formData.floors" type="text" inputmode="numeric" pattern="[0-9]*" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" @input="e => formData.floors = (e.target as HTMLInputElement).value.replace(/[^0-9]/g, '')" />
          </FormField>
          <FormField id="ws-form-positions" label="Posições" required>
            <input v-model="formData.positions" type="text" inputmode="numeric" pattern="[0-9]*" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" @input="e => formData.positions = (e.target as HTMLInputElement).value.replace(/[^0-9]/g, '')" />
          </FormField>
          <FormField id="ws-form-weight-capacity" label="Capacidade de Peso (kg)" required>
            <input v-model="formData.weightCapacity" type="text" inputmode="decimal" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" @input="e => formData.weightCapacity = (e.target as HTMLInputElement).value.replace(/[^0-9.]/g, '')" />
          </FormField>
        </div>

        <div class="grid grid-cols-3 gap-4">
          <FormField id="ws-form-height" label="Altura (cm)" required>
            <input v-model="formData.height" type="text" inputmode="decimal" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" @input="e => formData.height = (e.target as HTMLInputElement).value.replace(/[^0-9.]/g, '')" />
          </FormField>
          <FormField id="ws-form-width" label="Largura (cm)" required>
            <input v-model="formData.width" type="text" inputmode="decimal" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" @input="e => formData.width = (e.target as HTMLInputElement).value.replace(/[^0-9.]/g, '')" />
          </FormField>
          <FormField id="ws-form-depth" label="Profundidade (cm)" required>
            <input v-model="formData.depth" type="text" inputmode="decimal" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" @input="e => formData.depth = (e.target as HTMLInputElement).value.replace(/[^0-9.]/g, '')" />
          </FormField>
        </div>

        <FormField id="ws-form-max-height" label="Altura Máxima (cm)" required>
          <input v-model="formData.maxHeight" type="text" inputmode="decimal" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" @input="e => formData.maxHeight = (e.target as HTMLInputElement).value.replace(/[^0-9.]/g, '')" />
        </FormField>

        <FormField id="ws-form-position-type" label="Tipo de Posição" required>
          <select v-model="formData.positionType" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500">
            <option v-for="type in positionTypes" :value="type" :key="type">{{ type }}</option>
          </select>
        </FormField>

        <div class="flex items-center">
          <input v-model="formData.blocked" type="checkbox" id="ws-form-blocked" class="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
          <label for="ws-form-blocked" class="ml-2 text-sm text-gray-700">Bloqueada</label>
        </div>

        <!-- Seção de Geração de Posições (apenas no modo de edição).
             Precedente de seção condicional em formulário (§5.2) — fundo
             `bg-primary-50` (era `bg-blue-50`, desvio I8). -->
        <div v-if="editingStructure" class="border-t pt-4 mt-4">
          <div class="bg-primary-50 p-4 rounded-lg">
            <h4 class="text-sm font-semibold text-gray-900 mb-2">Geração de Posições</h4>
            <p class="text-sm text-gray-600 mb-3">
              Gere automaticamente {{ formData.floors }} andares com {{ formData.positions }} posições cada (total: {{ Number(formData.floors) * Number(formData.positions) }} posições).
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
          <Button type="submit" :disabled="saving" class="flex-1">{{ editingStructure ? 'Salvar' : 'Criar' }}</Button>
        </div>
      </form>
    </AppModal>

    <!-- Modal de Posições -->
    <AppModal
      v-model="showPositionsModal"
      size="lg"
      :title="`Posições - ${selectedStructure?.streetCode ?? ''}`"
      @close="closePositionsModal"
    >
      <DataTable
        :loading="loadingPositions"
        :error="positionsError"
        :items="storagePositions"
        empty-title="Nenhuma posição encontrada"
        empty-hint="Gere as posições da estrutura para vê-las aqui."
        @retry="retryPositions"
      >
        <template #head>
          <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código</th>
          <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Andar</th>
          <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Posição</th>
          <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
          <th scope="col" class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
        </template>

        <template #row="{ item }">
          <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{{ item.code }}</td>
          <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{{ item.floor }}</td>
          <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{{ item.position }}</td>
          <td class="px-4 py-3 whitespace-nowrap">
            <StatusBadge
              :label="item.blocked ? 'Bloqueada' : 'Disponível'"
              :tone="item.blocked ? 'danger' : 'success'"
            />
          </td>
          <td class="px-4 py-3 whitespace-nowrap text-right text-sm font-medium space-x-2">
            <button @click="toggleBlockPosition(item)" class="text-yellow-600 hover:text-yellow-900">
              {{ item.blocked ? 'Desbloquear' : 'Bloquear' }}
            </button>
            <button @click="deletePosition(item)" class="text-red-600 hover:text-red-900">Excluir</button>
          </td>
        </template>
      </DataTable>

      <template #footer>
        <div class="flex justify-between">
          <div class="flex gap-3">
            <Button @click="openStructureViewModal">
              <Squares2X2Icon class="w-4 h-4 mr-2 inline" />
              Ver Estrutura
            </Button>
            <Button
              v-if="storagePositions.length > 0"
              variant="danger"
              @click="deleteAllPositions"
              :disabled="deletingAllPositions"
            >
              <TrashIcon class="w-4 h-4 mr-2 inline" />
              {{ deletingAllPositions ? 'Excluindo...' : 'Excluir Todas' }}
            </Button>
          </div>
          <Button variant="outline" @click="closePositionsModal">Fechar</Button>
        </div>
      </template>
    </AppModal>

    <!-- Modal de Visualização de Estrutura (Grid) -->
    <AppModal
      v-model="showStructureViewModal"
      size="xl"
      :title="`Posições - ${selectedStructure?.streetCode ?? ''}`"
      @close="closeStructureViewModal"
    >
      <p class="text-sm text-gray-500 mb-6">
        {{ selectedStructure?.warehouse?.name }} | {{ selectedStructure?.floors }} andares x {{ selectedStructure?.positions }} posições
      </p>

      <!-- Legenda -->
      <div class="mb-6 flex gap-6 justify-center">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 bg-green-200 border border-green-300 rounded"></div>
          <span class="text-sm text-gray-700">Disponível</span>
        </div>
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 bg-red-200 border border-red-300 rounded"></div>
          <span class="text-sm text-gray-700">Bloqueada</span>
        </div>
      </div>

      <!-- Grid de Posições por Andar -->
      <div v-for="floor in floors" :key="floor" class="mb-8">
        <h4 class="text-center font-semibold text-gray-800 mb-3">Andar {{ floor }}</h4>
        <div class="overflow-x-auto">
          <table class="mx-auto border-collapse">
            <thead>
              <tr>
                <th class="border-2 border-gray-300 bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700">
                  Posição
                </th>
                <th
                  v-for="pos in positions"
                  :key="pos"
                  class="border-2 border-gray-300 bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 text-center"
                >
                  {{ pos }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="border-2 border-gray-300 bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 text-center">
                  {{ selectedStructure?.streetCode }}
                </td>
                <td
                  v-for="pos in positions"
                  :key="pos"
                  :title="getPositionInfo(floor, pos)"
                  :class="[
                    'border-2 border-gray-300 w-12 h-12 cursor-help transition-all hover:scale-110',
                    isPositionBlocked(floor, pos) ? 'bg-red-200 hover:bg-red-300' : 'bg-green-200 hover:bg-green-300'
                  ]"
                >
                  <!-- Conteúdo vazio, tooltip mostra info -->
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-if="storagePositions.length === 0" class="text-center py-12">
        <p class="text-gray-500">Nenhuma posição gerada ainda</p>
      </div>

      <template #footer>
        <div class="flex justify-end">
          <Button variant="outline" @click="closeStructureViewModal">Fechar</Button>
        </div>
      </template>
    </AppModal>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useWarehouseStructureStore } from '@/stores/warehouse-structure.store';
import { useWarehouseStore } from '@/stores/warehouse.store';
import { storagePositionService } from '@/services/storage-position.service';
import AppLayout from '@/components/common/AppLayout.vue';
import AppModal from '@/components/common/AppModal.vue';
import Button from '@/components/common/Button.vue';
import Card from '@/components/common/Card.vue';
import DataTable from '@/components/common/DataTable.vue';
import FormField from '@/components/common/FormField.vue';
import StatusBadge from '@/components/common/StatusBadge.vue';
import { useToast } from '@/composables/useToast';
import { confirmDialog } from '@/composables/useConfirm';
import { useDebounce } from '@/composables/useDebounce';
import { Squares2X2Icon, TrashIcon } from '@heroicons/vue/24/outline';
import type {
  ApiError,
  Pagination,
  StoragePosition,
  Warehouse,
  WarehouseStructure,
  WarehouseStructureFormData,
} from '@/types/warehouse.types';

const warehouseStructureStore = useWarehouseStructureStore();
const warehouseStore = useWarehouseStore();
const toast = useToast();

const structures = ref<WarehouseStructure[]>([]);
const warehouses = ref<Warehouse[]>([]);
const loading = ref(false);
// §4.4-5 / I11: erro de carregamento e um estado proprio, nunca "lista vazia".
const error = ref('');
const saving = ref(false);
const showModal = ref(false);
const editingStructure = ref<WarehouseStructure | null>(null);
const generatingPositions = ref(false);
const deletingPositions = ref(false);
const positionsCount = ref<number | null>(null);

// Modal de posições
const showPositionsModal = ref(false);
const selectedStructure = ref<WarehouseStructure | null>(null);
const storagePositions = ref<StoragePosition[]>([]);
const loadingPositions = ref(false);
const positionsError = ref('');

// Modal de visualização de estrutura (grid)
const showStructureViewModal = ref(false);
const floors = ref<number[]>([]);
const positions = ref<number[]>([]);
const deletingAllPositions = ref(false);

const filters = ref<{ search: string; blocked: string }>({ search: '', blocked: '' });
const pagination = ref<Pagination>({ page: 1, limit: 100, total: 0, pages: 0 });

const formData = ref<WarehouseStructureFormData>({
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
    error.value = '';
    const result = await warehouseStructureStore.fetchStructures(pagination.value.page, pagination.value.limit, filters.value);
    structures.value = result.data;
    pagination.value = result.pagination;
  } catch (e) {
    error.value = (e as ApiError).response?.data?.message || 'Erro ao carregar estruturas';
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
const debouncedFilterChange = useDebounce(handleFilterChange, 350);

const changePage = (page: number) => {
  pagination.value.page = page;
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

const openEditModal = async (structure: WarehouseStructure) => {
  if ((structure.generatedPositionsCount ?? 0) > 0) {
    toast.warning('Não é possível editar uma estrutura com posições geradas. Exclua as posições primeiro.');
    return;
  }

  editingStructure.value = structure;
  formData.value = { ...structure } as unknown as WarehouseStructureFormData;
  showModal.value = true;

  // Carregar contagem de posições
  await loadPositionsCount(structure.id);
};

// Esc, focus trap e devolucao de foco agora vem do AppModal (§4.2).
const closeModal = () => {
  showModal.value = false;
  editingStructure.value = null;
  positionsCount.value = null;
};

const loadPositionsCount = async (structureId: string) => {
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

  if (!(await confirmDialog(`Deseja gerar ${Number(formData.value.floors) * Number(formData.value.positions)} posições para esta estrutura?`))) {
    return;
  }

  try {
    generatingPositions.value = true;
    const response = await storagePositionService.generatePositions(editingStructure.value.id);
    toast.success(response.message);
    await loadPositionsCount(editingStructure.value.id);
    await loadStructures(); // Recarregar lista para atualizar contagem
  } catch (error) {
    toast.error((error as ApiError).response?.data?.message || 'Erro ao gerar posições');
  } finally {
    generatingPositions.value = false;
  }
};
const handleDeletePositions = async () => {
  if (!editingStructure.value) return;

  if (!(await confirmDialog('Deseja realmente excluir todas as posições desta estrutura? Esta ação não pode ser desfeita.'))) {
    return;
  }

  try {
    deletingPositions.value = true;
    const response = await storagePositionService.deletePositions(editingStructure.value.id);
    toast.success(response.message);
    await loadPositionsCount(editingStructure.value.id);
    await loadStructures(); // Recarregar lista para atualizar contagem
  } catch (error) {
    toast.error((error as ApiError).response?.data?.message || 'Erro ao excluir posições');
  } finally {
    deletingPositions.value = false;
  }
};

const handleSubmit = async () => {
  try {
    saving.value = true;
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
      toast.success('Estrutura atualizada com sucesso!');
    } else {
      await warehouseStructureStore.createStructure(submitData);
      toast.success('Estrutura criada com sucesso!');
    }
    closeModal();
    await loadStructures();
  } catch (error) {
    toast.error((error as ApiError).response?.data?.message || 'Erro ao salvar estrutura');
  } finally {
    saving.value = false;
  }
};

const handleDelete = async (structure: WarehouseStructure) => {
  if ((structure.generatedPositionsCount ?? 0) > 0) {
    toast.warning('Não é possível excluir uma estrutura com posições geradas. Exclua as posições primeiro.');
    return;
  }

  if (await confirmDialog(`Deseja realmente excluir a estrutura "${structure.streetCode}"?`)) {
    try {
      await warehouseStructureStore.deleteStructure(structure.id);
      toast.success('Estrutura excluída com sucesso!');
      await loadStructures();
    } catch (error) {
      toast.error((error as ApiError).response?.data?.message || 'Erro ao excluir estrutura');
    }
  }
};

// Funções do modal de posições
const openPositionsModal = async (structure: WarehouseStructure) => {
  selectedStructure.value = structure;
  showPositionsModal.value = true;
  await loadStoragePositions(structure.id);
};

const closePositionsModal = () => {
  showPositionsModal.value = false;
  selectedStructure.value = null;
  storagePositions.value = [];
  positionsError.value = '';
};

const loadStoragePositions = async (structureId: string) => {
  try {
    loadingPositions.value = true;
    positionsError.value = '';
    const response = await storagePositionService.getPositions(structureId);
    storagePositions.value = response.data;
  } catch (error) {
    // I10/I11: a falha vira estado de tela com "Tentar Novamente" em vez de
    // um console.error mudo + toast que some.
    console.error('Erro ao carregar posições:', error);
    positionsError.value = (error as ApiError).response?.data?.message || 'Erro ao carregar posições';
  } finally {
    loadingPositions.value = false;
  }
};

const retryPositions = () => {
  if (!selectedStructure.value) return;
  loadStoragePositions(selectedStructure.value.id);
};

const toggleBlockPosition = async (position: StoragePosition) => {
  try {
    await storagePositionService.updatePosition(position.id, {
      blocked: !position.blocked
    });

    // Atualizar localmente
    position.blocked = !position.blocked;

    toast.success(`Posição ${position.blocked ? 'bloqueada' : 'desbloqueada'} com sucesso!`);
  } catch (error) {
    console.error('Erro ao atualizar posição:', error);
    toast.error('Erro ao atualizar posição');
  }
};

const deletePosition = async (position: StoragePosition) => {
  if (!(await confirmDialog(`Deseja realmente excluir a posição "${position.code}"?`))) {
    return;
  }

  try {
    await storagePositionService.deletePosition(position.id);

    // Remover da lista local
    storagePositions.value = storagePositions.value.filter(p => p.id !== position.id);

    // Atualizar contagem no grid principal
    await loadStructures();

    toast.success('Posição excluída com sucesso!');
  } catch (error) {
    console.error('Erro ao excluir posição:', error);
    toast.error('Erro ao excluir posição');
  }
};

// Funções do modal de visualização de estrutura
const openStructureViewModal = () => {
  if (!selectedStructure.value) return;

  // Gerar arrays de andares e posições
  floors.value = Array.from({ length: selectedStructure.value.floors }, (_, i) => i + 1).reverse();
  positions.value = Array.from({ length: selectedStructure.value.positions }, (_, i) => i + 1);

  showStructureViewModal.value = true;
};

const closeStructureViewModal = () => {
  showStructureViewModal.value = false;
};

const getPositionInfo = (floor: number, position: number) => {
  const code = `${selectedStructure.value?.streetCode}-${String(floor).padStart(2, '0')}-${String(position).padStart(2, '0')}`;
  const pos = storagePositions.value.find(p => p.floor === floor && p.position === position);

  if (!pos) {
    return `${code} - Posição não gerada`;
  }

  return `${code}\nStatus: ${pos.blocked ? 'Bloqueada' : 'Disponível'}`;
};

const isPositionBlocked = (floor: number, position: number) => {
  const pos = storagePositions.value.find(p => p.floor === floor && p.position === position);
  return pos?.blocked || false;
}

const deleteAllPositions = async () => {
  if (!selectedStructure.value) return;

  const count = storagePositions.value.length;

  if (!(await confirmDialog(`Deseja realmente excluir todas as ${count} posições desta estrutura?\n\nEsta ação não pode ser desfeita.`))) {
    return;
  }

  try {
    deletingAllPositions.value = true;
    const response = await storagePositionService.deletePositions(selectedStructure.value.id);

    // Limpar lista local
    storagePositions.value = [];

    // Atualizar contagem no grid principal
    await loadStructures();

    toast.success(response.message || `${count} posições excluídas com sucesso!`);
  } catch (error) {
    console.error('Erro ao excluir todas as posições:', error);
    toast.error((error as ApiError).response?.data?.message || 'Erro ao excluir posições');
  } finally {
    deletingAllPositions.value = false;
  }
};

onMounted(() => {
  loadStructures();
  loadWarehouses();
});
</script>
