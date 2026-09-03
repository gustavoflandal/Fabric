<template>
  <AppLayout title="Apontamentos de Produção" subtitle="Gerencie os apontamentos de produção">
    <template #actions>
      <Button @click="showCreateModal = true"><span class="mr-2">+</span>Novo Apontamento</Button>
    </template>

    <Card class="mb-6">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormField id="pp-filter-search" label="Buscar" class="md:col-span-2">
          <input
            v-model="filters.search"
            type="text"
            placeholder="Buscar..."
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            @input="debouncedLoadPointings"
          />
        </FormField>
        <FormField id="pp-filter-status" label="Status">
          <select
            v-model="filters.status"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            @change="loadPointings"
          >
            <option value="">Todos os Status</option>
            <option value="IN_PROGRESS">Em Progresso</option>
            <option value="COMPLETED">Concluído</option>
          </select>
        </FormField>
      </div>
    </Card>

    <DataTable
      :loading="loading"
      :error="error"
      :items="pointings"
      empty-title="Nenhum apontamento encontrado"
      empty-hint="Ajuste os filtros ou registre um novo apontamento."
      @retry="loadPointings"
    >
      <template #empty-action>
        <Button @click="showCreateModal = true"><span class="mr-2">+</span>Novo Apontamento</Button>
      </template>

      <template #head>
        <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Ordem</th>
        <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">Operação</th>
        <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Operador</th>
        <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-36">Início</th>
        <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-36">Fim</th>
        <th scope="col" class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Qtd Boa</th>
        <th scope="col" class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Refugo</th>
        <th scope="col" class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-28">Ações</th>
      </template>

      <template #row="{ item }">
        <td class="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
          {{ item.productionOrder?.orderNumber }}
        </td>
        <td class="px-4 py-4 text-sm text-gray-900">
          <div class="font-medium">Op {{ item.operation?.sequence }}</div>
          <div class="text-xs text-gray-500">{{ item.operation?.description }}</div>
        </td>
        <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
          {{ item.user?.name }}
        </td>
        <td class="px-4 py-4 text-sm text-gray-500">
          {{ formatDateTime(item.startTime) }}
        </td>
        <td class="px-4 py-4 text-sm text-gray-500">
          {{ formatDateTime(item.endTime) }}
        </td>
        <td class="px-4 py-4 whitespace-nowrap text-sm text-right text-green-600 font-semibold">
          {{ item.quantityGood }}
        </td>
        <td class="px-4 py-4 whitespace-nowrap text-sm text-right text-red-600">
          {{ item.quantityScrap }}
        </td>
        <td class="px-4 py-4 text-right text-sm font-medium">
          <button @click="handleDelete(item)" class="text-red-600 hover:text-red-900 whitespace-nowrap">Excluir</button>
        </td>
      </template>
    </DataTable>

    <!-- Modal de Criação — Esc/focus trap agora vêm do AppModal (§4.2). -->
    <AppModal v-model="showCreateModal" title="Novo Apontamento de Produção" @close="closeModal">
      <form @submit.prevent="handleCreate" class="space-y-4">
        <FormField id="pp-form-order" label="Ordem de Produção" required>
          <select
            v-model="form.productionOrderId"
            required
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            @change="loadOperations"
          >
            <option value="">Selecione uma ordem</option>
            <option v-for="order in productionOrders" :key="order.id" :value="order.id">
              {{ order.orderNumber }} - {{ order.product?.name }}
            </option>
          </select>
        </FormField>

        <FormField id="pp-form-operation" label="Operação" required>
          <select
            v-model="form.operationId"
            required
            :disabled="!form.productionOrderId"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 disabled:bg-gray-100"
          >
            <option value="">Selecione uma operação</option>
            <option v-for="op in operations" :key="op.id" :value="op.id">
              Op {{ op.sequence }} - {{ op.description }}
            </option>
          </select>
        </FormField>

        <!-- Período — delimitação de seção do precedente de ProductsView (§5.2). -->
        <div class="border-t pt-4 mt-4 space-y-4">
          <h4 class="text-sm font-semibold text-gray-900">Período</h4>

          <div class="grid grid-cols-2 gap-4">
            <FormField id="pp-form-start-time" label="Início" required>
              <input
                v-model="form.startTime"
                type="datetime-local"
                required
                class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              />
            </FormField>
            <FormField id="pp-form-end-time" label="Fim">
              <input
                v-model="form.endTime"
                type="datetime-local"
                class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              />
            </FormField>
          </div>
        </div>

        <!-- Quantidades -->
        <div class="border-t pt-4 mt-4 space-y-4">
          <h4 class="text-sm font-semibold text-gray-900">Quantidades</h4>

          <div class="grid grid-cols-2 gap-4">
            <FormField id="pp-form-quantity-good" label="Quantidade Boa" required>
              <input
                v-model.number="form.quantityGood"
                type="number"
                min="0"
                step="1"
                required
                class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              />
            </FormField>
            <FormField id="pp-form-quantity-scrap" label="Quantidade Refugo">
              <input
                v-model.number="form.quantityScrap"
                type="number"
                min="0"
                step="1"
                class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              />
            </FormField>
          </div>
        </div>

        <FormField id="pp-form-notes" label="Observações">
          <textarea
            v-model="form.notes"
            rows="3"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            placeholder="Observações sobre o apontamento..."
          ></textarea>
        </FormField>

        <div class="flex gap-3 pt-4">
          <Button type="button" variant="outline" @click="closeModal" class="flex-1">Cancelar</Button>
          <Button type="submit" :disabled="submitting" class="flex-1">
            {{ submitting ? 'Salvando...' : 'Salvar Apontamento' }}
          </Button>
        </div>
      </form>
    </AppModal>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useProductionPointingStore } from '@/stores/production-pointing.store';
import type { ProductionPointing } from '@/services/production-pointing.service';
import AppLayout from '@/components/common/AppLayout.vue';
import AppModal from '@/components/common/AppModal.vue';
import Button from '@/components/common/Button.vue';
import Card from '@/components/common/Card.vue';
import DataTable from '@/components/common/DataTable.vue';
import FormField from '@/components/common/FormField.vue';
import { useToast } from '@/composables/useToast';
import { confirmDialog } from '@/composables/useConfirm';
import { useDebounce } from '@/composables/useDebounce';

const pointingStore = useProductionPointingStore();
const toast = useToast();

const pointings = ref<ProductionPointing[]>([]);
const loading = ref(false);
// §4.4-5 / I11: erro de carregamento e um estado proprio, nunca "lista vazia".
const error = ref('');
const showCreateModal = ref(false);
const submitting = ref(false);
const filters = ref({ search: '', status: '' });

const productionOrders = ref<any[]>([]);
const operations = ref<any[]>([]);

const form = ref({
  productionOrderId: '',
  operationId: '',
  startTime: '',
  endTime: '',
  quantityGood: 0,
  quantityScrap: 0,
  notes: '',
});

onMounted(async () => {
  await loadPointings();
  await loadProductionOrders();
});

const loadPointings = async () => {
  loading.value = true;
  error.value = '';
  try {
    const result = await pointingStore.fetchPointings(filters.value);
    pointings.value = result.data;
  } catch (e: any) {
    error.value = e.response?.data?.message || 'Erro ao carregar apontamentos';
  } finally {
    loading.value = false;
  }
};
const debouncedLoadPointings = useDebounce(loadPointings, 350);

const handleDelete = async (pointing: ProductionPointing) => {
  if (!(await confirmDialog('Deseja realmente excluir este apontamento?'))) return;

  try {
    await pointingStore.deletePointing(pointing.id);
    toast.success('Apontamento excluído com sucesso!');
    await loadPointings();
  } catch (error: any) {
    toast.error(error.response?.data?.message || 'Erro ao excluir apontamento');
  }
};

const loadProductionOrders = async () => {
  try {
    // Buscar ordens em andamento ou planejadas
    const response = await fetch('http://localhost:3005/api/v1/production-orders?status=IN_PROGRESS,PLANNED', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
      }
    });
    const data = await response.json();
    productionOrders.value = data.data.data || [];
  } catch (error) {
    console.error('Erro ao carregar ordens:', error);
  }
};

const loadOperations = async () => {
  if (!form.value.productionOrderId) {
    operations.value = [];
    return;
  }

  try {
    // Buscar operações da ordem selecionada
    const response = await fetch(`http://localhost:3005/api/v1/production-orders/${form.value.productionOrderId}/operations`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
      }
    });
    const data = await response.json();
    operations.value = data.data || [];
  } catch (error) {
    console.error('Erro ao carregar operações:', error);
    operations.value = [];
  }
};

const handleCreate = async () => {
  submitting.value = true;
  try {
    await pointingStore.createPointing({
      productionOrderId: form.value.productionOrderId,
      operationId: form.value.operationId,
      startTime: new Date(form.value.startTime).toISOString(),
      endTime: form.value.endTime ? new Date(form.value.endTime).toISOString() : undefined,
      quantityGood: form.value.quantityGood,
      quantityScrap: form.value.quantityScrap || 0,
      notes: form.value.notes || undefined,
    });

    toast.success('Apontamento criado com sucesso!');
    closeModal();
    await loadPointings();
  } catch (error: any) {
    toast.error(error.response?.data?.message || 'Erro ao criar apontamento');
  } finally {
    submitting.value = false;
  }
};

const closeModal = () => {
  showCreateModal.value = false;
  form.value = {
    productionOrderId: '',
    operationId: '',
    startTime: '',
    endTime: '',
    quantityGood: 0,
    quantityScrap: 0,
    notes: '',
  };
  operations.value = [];
};

const formatDateTime = (dateString: string) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};
</script>
