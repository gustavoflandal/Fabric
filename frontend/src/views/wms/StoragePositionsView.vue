<template>
  <AppLayout title="Localizações" subtitle="Busque e gerencie os endereços de armazenagem do WMS">
    <Card class="mb-6">
      <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <FormField id="sp-filter-warehouse" label="Armazém">
          <select
            v-model="filters.warehouseId"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            @change="handleFilterChange"
          >
            <option value="">Todos</option>
            <option v-for="warehouse in warehouses" :value="warehouse.id" :key="warehouse.id">{{ warehouse.name }}</option>
          </select>
        </FormField>
        <FormField id="sp-filter-street" label="Rua">
          <input
            v-model="filters.streetCode"
            type="text"
            placeholder="Código da rua"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            @input="debouncedFilterChange"
          />
        </FormField>
        <FormField id="sp-filter-blocked" label="Bloqueada">
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
        <FormField id="sp-filter-picking" label="Área de Picking">
          <select
            v-model="filters.isPickingArea"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            @change="handleFilterChange"
          >
            <option value="">Todas</option>
            <option value="true">Sim</option>
            <option value="false">Não</option>
          </select>
        </FormField>
        <FormField id="sp-filter-occupied" label="Ocupada">
          <select
            v-model="filters.occupied"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            @change="handleFilterChange"
          >
            <option value="">Todas</option>
            <option value="true">Sim</option>
            <option value="false">Não</option>
          </select>
        </FormField>
        <FormField id="sp-filter-code" label="Código">
          <input
            v-model="filters.code"
            type="text"
            placeholder="Busca por código..."
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            @input="debouncedFilterChange"
          />
        </FormField>
      </div>
    </Card>

    <DataTable
      :loading="loading"
      :error="error"
      :items="positions"
      :pagination="pagination"
      empty-title="Nenhuma posição encontrada"
      empty-hint="Ajuste os filtros de busca."
      @retry="loadPositions"
      @change-page="changePage"
    >
      <template #head>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Armazém</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rua</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Andar/Posição</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bloqueada</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Área de Picking</th>
        <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
      </template>

      <template #row="{ item }">
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ item.code }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          {{ item.structure?.warehouse?.name ?? item.warehouseCode }}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ item.streetCode }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ item.floor }}/{{ item.position }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ positionTypeLabel(item.positionType) }}</td>
        <td class="px-6 py-4 whitespace-nowrap">
          <StatusBadge :label="item.blocked ? 'Sim' : 'Não'" :tone="item.blocked ? 'danger' : 'success'" />
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <StatusBadge :label="item.isPickingArea ? 'Sim' : 'Não'" :tone="item.isPickingArea ? 'info' : 'neutral'" />
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
          <button @click="openEditModal(item)" class="text-primary-600 hover:text-primary-900">Editar</button>
          <button @click="openHistoryModal(item)" class="text-gray-600 hover:text-gray-900">Ver Histórico</button>
        </td>
      </template>
    </DataTable>

    <!-- Edição da posição: apenas bloqueio e área de picking são editáveis por
         esta rota (identidade — código/armazém/rua/andar/posição — é só texto). -->
    <AppModal v-model="showEditModal" :title="`Editar Posição - ${editingPosition?.code ?? ''}`" @close="closeEditModal">
      <form @submit.prevent="handleEditSubmit" class="space-y-4">
        <div class="grid grid-cols-2 gap-4 text-sm text-gray-600">
          <div><span class="font-medium text-gray-800">Código:</span> {{ editingPosition?.code }}</div>
          <div><span class="font-medium text-gray-800">Armazém:</span> {{ editingPosition?.structure?.warehouse?.name ?? editingPosition?.warehouseCode }}</div>
          <div><span class="font-medium text-gray-800">Rua:</span> {{ editingPosition?.streetCode }}</div>
          <div><span class="font-medium text-gray-800">Andar/Posição:</span> {{ editingPosition?.floor }}/{{ editingPosition?.position }}</div>
        </div>

        <div class="flex items-center">
          <input v-model="editForm.blocked" type="checkbox" id="sp-form-blocked" class="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
          <label for="sp-form-blocked" class="ml-2 text-sm text-gray-700">Bloqueada</label>
        </div>
        <div class="flex items-center">
          <input v-model="editForm.isPickingArea" type="checkbox" id="sp-form-picking" class="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
          <label for="sp-form-picking" class="ml-2 text-sm text-gray-700">Área de Picking</label>
        </div>

        <div class="flex gap-3 pt-4">
          <Button type="button" variant="outline" @click="closeEditModal" class="flex-1">Cancelar</Button>
          <Button type="submit" :disabled="saving" class="flex-1">{{ saving ? 'Salvando...' : 'Salvar' }}</Button>
        </div>
      </form>
    </AppModal>

    <!-- Histórico de movimentação do endereço (F2.4). -->
    <AppModal v-model="showHistoryModal" size="lg" :title="`Histórico - ${historyPosition?.code ?? ''}`" @close="closeHistoryModal">
      <DataTable
        :loading="loadingHistory"
        :error="historyError"
        :items="movements"
        empty-title="Nenhuma movimentação encontrada"
        empty-hint="Este endereço ainda não recebeu nem enviou material."
        @retry="retryHistory"
      >
        <template #head>
          <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produto</th>
          <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
          <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantidade</th>
          <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
        </template>

        <template #row="{ item }">
          <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{{ item.product?.code }} - {{ item.product?.name }}</td>
          <td class="px-4 py-3 whitespace-nowrap">
            <StatusBadge :label="item.direction === 'IN' ? 'Entrada' : 'Saída'" :tone="item.direction === 'IN' ? 'success' : 'warning'" />
          </td>
          <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{{ item.quantity }}</td>
          <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{{ formatDate(item.createdAt) }}</td>
        </template>
      </DataTable>

      <template #footer>
        <div class="flex justify-end">
          <Button variant="outline" @click="closeHistoryModal">Fechar</Button>
        </div>
      </template>
    </AppModal>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useStoragePositionStore } from '@/stores/storage-position.store';
import { useWarehouseStore } from '@/stores/warehouse.store';
import { storagePositionService } from '@/services/storage-position.service';
import AppLayout from '@/components/common/AppLayout.vue';
import AppModal from '@/components/common/AppModal.vue';
import Button from '@/components/common/Button.vue';
import Card from '@/components/common/Card.vue';
import DataTable from '@/components/common/DataTable.vue';
import type { Pagination } from '@/components/common/DataTable.vue';
import FormField from '@/components/common/FormField.vue';
import StatusBadge from '@/components/common/StatusBadge.vue';
import { useToast } from '@/composables/useToast';
import { useDebounce } from '@/composables/useDebounce';
import { POSITION_TYPE_LABELS } from '@/types/warehouse.types';
import type {
  ApiError,
  StoragePosition,
  StoragePositionMovement,
  Warehouse,
} from '@/types/warehouse.types';

const storagePositionStore = useStoragePositionStore();
const warehouseStore = useWarehouseStore();
const toast = useToast();

const positions = ref<StoragePosition[]>([]);
const warehouses = ref<Warehouse[]>([]);
const loading = ref(false);
const error = ref('');
const saving = ref(false);

const filters = ref<{
  warehouseId: string;
  streetCode: string;
  blocked: string;
  isPickingArea: string;
  occupied: string;
  code: string;
}>({ warehouseId: '', streetCode: '', blocked: '', isPickingArea: '', occupied: '', code: '' });

// A API devolve `totalPages` (não `pages`, que é a convenção do resto do
// projeto) — ver a nota em storage-position.store.ts. `pagination` local já
// nasce no formato que o DataTable espera.
const pagination = ref<Pagination>({ page: 1, limit: 20, total: 0, pages: 0 });

// Modal de edição
const showEditModal = ref(false);
const editingPosition = ref<StoragePosition | null>(null);
const editForm = ref<{ blocked: boolean; isPickingArea: boolean }>({ blocked: false, isPickingArea: false });

// Modal de histórico
const showHistoryModal = ref(false);
const historyPosition = ref<StoragePosition | null>(null);
const movements = ref<StoragePositionMovement[]>([]);
const loadingHistory = ref(false);
const historyError = ref('');

const loadPositions = async () => {
  try {
    loading.value = true;
    error.value = '';
    const result = await storagePositionStore.search(
      {
        warehouseId: filters.value.warehouseId || undefined,
        streetCode: filters.value.streetCode || undefined,
        blocked: filters.value.blocked || undefined,
        isPickingArea: filters.value.isPickingArea || undefined,
        occupied: filters.value.occupied || undefined,
        code: filters.value.code || undefined,
      },
      pagination.value.page,
      pagination.value.limit
    );
    positions.value = result.items;
    pagination.value = {
      page: result.pagination.page,
      limit: result.pagination.limit,
      total: result.pagination.total,
      pages: result.pagination.totalPages,
    };
  } catch (e) {
    error.value = (e as ApiError).response?.data?.message || 'Erro ao carregar posições';
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
  loadPositions();
};
const debouncedFilterChange = useDebounce(handleFilterChange, 350);

const changePage = (page: number) => {
  pagination.value.page = page;
  loadPositions();
};

const openEditModal = (position: StoragePosition) => {
  editingPosition.value = position;
  editForm.value = { blocked: position.blocked, isPickingArea: position.isPickingArea };
  showEditModal.value = true;
};

const closeEditModal = () => {
  showEditModal.value = false;
  editingPosition.value = null;
};

const handleEditSubmit = async () => {
  if (!editingPosition.value) return;

  try {
    saving.value = true;
    await storagePositionStore.updatePosition(editingPosition.value.id, {
      blocked: editForm.value.blocked,
      isPickingArea: editForm.value.isPickingArea,
    });
    toast.success('Posição atualizada com sucesso!');
    closeEditModal();
    await loadPositions();
  } catch (e) {
    toast.error((e as ApiError).response?.data?.message || 'Erro ao atualizar posição');
  } finally {
    saving.value = false;
  }
};

const openHistoryModal = async (position: StoragePosition) => {
  historyPosition.value = position;
  showHistoryModal.value = true;
  await loadHistory(position.id);
};

const closeHistoryModal = () => {
  showHistoryModal.value = false;
  historyPosition.value = null;
  movements.value = [];
  historyError.value = '';
};

const loadHistory = async (positionId: string) => {
  try {
    loadingHistory.value = true;
    historyError.value = '';
    const response = await storagePositionService.getMovements(positionId);
    movements.value = response.data?.movements ?? [];
  } catch (e) {
    historyError.value = (e as ApiError).response?.data?.message || 'Erro ao carregar histórico';
  } finally {
    loadingHistory.value = false;
  }
};

const retryHistory = () => {
  if (!historyPosition.value) return;
  loadHistory(historyPosition.value.id);
};

const formatDate = (date: string) => new Date(date).toLocaleString('pt-BR');

const positionTypeLabel = (type?: string) => (type ? POSITION_TYPE_LABELS[type] ?? type : '—');

onMounted(() => {
  loadPositions();
  loadWarehouses();
});
</script>
