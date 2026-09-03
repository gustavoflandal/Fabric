<template>
  <AppLayout title="Unidades de Medida" subtitle="Gerencie as unidades de medida do sistema">
    <template #actions>
      <Button @click="openCreateModal"><span class="mr-2">+</span>Nova Unidade</Button>
    </template>

    <Card class="mb-6">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <FormField id="uom-filter-search" label="Buscar">
          <input
            v-model="filters.search"
            type="text"
            placeholder="Código, nome ou símbolo..."
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            @input="debouncedFilterChange"
          />
        </FormField>

        <FormField id="uom-filter-type" label="Tipo">
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
        </FormField>

        <FormField id="uom-filter-active" label="Status">
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

        <div class="flex items-end">
          <Button variant="outline" @click="clearFilters" class="w-full">Limpar Filtros</Button>
        </div>
      </div>
    </Card>

    <DataTable
      :loading="loading"
      :error="error"
      :items="units"
      :pagination="pagination"
      empty-title="Nenhuma unidade de medida encontrada"
      empty-hint="Ajuste os filtros ou cadastre uma nova unidade de medida."
      @retry="loadUnits"
      @change-page="changePage"
    >
      <template #empty-action>
        <Button @click="openCreateModal"><span class="mr-2">+</span>Nova Unidade</Button>
      </template>

      <template #head>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Símbolo</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
        <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
      </template>

      <template #row="{ item }">
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ asItem(item).code }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{{ asItem(item).name }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ getTypeLabel(asItem(item).type) }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ asItem(item).symbol || '-' }}</td>
        <td class="px-6 py-4 whitespace-nowrap">
          <StatusBadge
            :label="asItem(item).active ? 'Ativo' : 'Inativo'"
            :tone="asItem(item).active ? 'success' : 'danger'"
          />
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
          <button @click="openEditModal(asItem(item))" class="text-primary-600 hover:text-primary-900">Editar</button>
          <button @click="handleToggleActive(asItem(item))" class="text-yellow-600 hover:text-yellow-900">
            {{ asItem(item).active ? 'Desativar' : 'Ativar' }}
          </button>
          <button @click="handleDelete(asItem(item))" class="text-red-600 hover:text-red-900">Excluir</button>
        </td>
      </template>
    </DataTable>

    <AppModal
      v-model="showModal"
      :title="editingUnit ? 'Editar Unidade' : 'Nova Unidade'"
      size="sm"
      @close="closeModal"
    >
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <FormField id="uom-form-code" label="Código" required>
          <input
            v-model="formData.code"
            type="text"
            required
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            placeholder="Ex: UN, KG, M"
          />
        </FormField>

        <FormField id="uom-form-name" label="Nome" required>
          <input
            v-model="formData.name"
            type="text"
            required
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            placeholder="Ex: Unidade, Quilograma, Metro"
          />
        </FormField>

        <FormField id="uom-form-type" label="Tipo" required>
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
        </FormField>

        <FormField id="uom-form-symbol" label="Símbolo">
          <input
            v-model="formData.symbol"
            type="text"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            placeholder="Ex: un, kg, m"
          />
        </FormField>

        <div class="flex items-center">
          <input v-model="formData.active" type="checkbox" id="uom-form-active" class="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
          <label for="uom-form-active" class="ml-2 text-sm text-gray-700">Ativo</label>
        </div>

        <div class="flex gap-3 pt-4">
          <Button type="button" variant="outline" @click="closeModal" class="flex-1">Cancelar</Button>
          <Button type="submit" :disabled="saving" class="flex-1">{{ editingUnit ? 'Salvar' : 'Criar' }}</Button>
        </div>
      </form>
    </AppModal>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useUnitOfMeasureStore } from '@/stores/unit-of-measure.store';
import type { UnitOfMeasure } from '@/services/unit-of-measure.service';
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

const unitStore = useUnitOfMeasureStore();
const toast = useToast();

const units = ref<UnitOfMeasure[]>([]);
const loading = ref(false);
// §4.4-5 / I11: erro de carregamento e um estado proprio, nunca "lista vazia".
const error = ref('');
const saving = ref(false);
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

// DataTable expoe o item do slot #row como `unknown` (o componente nao e generico);
// este e o unico ponto de cast da view, mantendo o template tipado.
const asItem = (item: unknown) => item as UnitOfMeasure;

const loadUnits = async () => {
  try {
    loading.value = true;
    error.value = '';
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
  } catch (e: any) {
    // Antes o erro morria em console.error e a tela mostrava "nenhuma unidade" (I10/I11).
    error.value = e.response?.data?.message || 'Erro ao carregar unidades de medida';
  } finally {
    loading.value = false;
  }
};

const handleFilterChange = () => {
  pagination.value.page = 1;
  loadUnits();
};
const debouncedFilterChange = useDebounce(handleFilterChange, 350);

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

// Esc, focus trap e devolucao de foco agora vem do AppModal (§4.2).
const closeModal = () => {
  showModal.value = false;
  editingUnit.value = null;
};

const handleSubmit = async () => {
  try {
    saving.value = true;
    if (editingUnit.value) {
      await unitStore.updateUnit(editingUnit.value.id, formData.value);
      toast.success('Unidade atualizada com sucesso!');
    } else {
      await unitStore.createUnit(formData.value);
      toast.success('Unidade criada com sucesso!');
    }
    closeModal();
    await loadUnits();
  } catch (error: any) {
    toast.error(error.response?.data?.message || 'Erro ao salvar unidade');
  } finally {
    saving.value = false;
  }
};

const handleToggleActive = async (unit: UnitOfMeasure) => {
  if (await confirmDialog(`Deseja ${unit.active ? 'desativar' : 'ativar'} a unidade "${unit.name}"?`)) {
    const acao = unit.active ? 'desativada' : 'ativada';
    try {
      await unitStore.toggleActive(unit.id);
      toast.success(`Unidade ${acao} com sucesso!`);
      await loadUnits();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao alterar status');
    }
  }
};

const handleDelete = async (unit: UnitOfMeasure) => {
  if (await confirmDialog(`Deseja realmente excluir a unidade "${unit.name}"?\n\nEsta ação não pode ser desfeita.`)) {
    try {
      await unitStore.deleteUnit(unit.id);
      toast.success('Unidade excluída com sucesso!');
      await loadUnits();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao excluir unidade');
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

onMounted(() => {
  loadUnits();
});
</script>
