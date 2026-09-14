<template>
  <AppLayout title="Romaneios" subtitle="Expedição física dos pedidos de venda — um pedido pode gerar vários romaneios">
    <template #actions>
      <Button @click="openCreateModal"><span class="mr-2">+</span>Criar Romaneio</Button>
    </template>

    <Card class="mb-6">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormField id="sh-filter-status" label="Status">
          <select
            v-model="filters.status"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            @change="handleFilterChange"
          >
            <option value="">Todos</option>
            <option v-for="status in SHIPMENT_STATUSES" :key="status" :value="status">
              {{ SHIPMENT_STATUS_LABELS[status] }}
            </option>
          </select>
        </FormField>
        <FormField id="sh-filter-warehouse" label="Armazém">
          <select
            v-model="filters.warehouseId"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            @change="handleFilterChange"
          >
            <option value="">Todos</option>
            <option v-for="warehouse in warehouses" :key="warehouse.id" :value="warehouse.id">
              {{ warehouse.code }} - {{ warehouse.name }}
            </option>
          </select>
        </FormField>
        <FormField
          id="sh-filter-sales-order"
          label="Pedido de Venda"
          hint="Preenchido ao chegar pela tela de pedidos"
        >
          <select
            v-model="filters.salesOrderId"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            @change="handleFilterChange"
          >
            <option value="">Todos</option>
            <option v-for="order in shippableOrders" :key="order.id" :value="order.id">
              {{ order.orderNumber }} - {{ order.customer?.name ?? '' }}
            </option>
          </select>
        </FormField>
      </div>
    </Card>

    <DataTable
      :loading="loading"
      :error="error"
      :items="shipments"
      :pagination="pagination"
      empty-title="Nenhum romaneio encontrado"
      empty-hint="Ajuste os filtros ou crie um romaneio a partir de um pedido confirmado."
      @retry="loadShipments"
      @change-page="changePage"
    >
      <template #empty-action>
        <Button @click="openCreateModal"><span class="mr-2">+</span>Criar Romaneio</Button>
      </template>

      <template #head>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Número</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pedido</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Armazém</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Itens</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Criado em</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Despachado em</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
        <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
      </template>

      <template #row="{ item }">
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ item.shipmentNumber }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{{ item.salesOrder?.orderNumber ?? '—' }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ item.salesOrder?.customer?.name ?? '—' }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ item.warehouse?.name ?? '—' }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ item.items?.length ?? 0 }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ formatDateTime(item.createdAt) }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ formatDateTime(item.dispatchedAt) }}</td>
        <td class="px-6 py-4 whitespace-nowrap">
          <StatusBadge :label="SHIPMENT_STATUS_LABELS[item.status]" :tone="statusTone(item.status)" />
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
          <RouterLink :to="`/shipments/${item.id}`" class="text-primary-600 hover:text-primary-900">
            Detalhes
          </RouterLink>
          <button
            v-if="canCancel(item)"
            @click="handleCancel(item)"
            class="text-red-600 hover:text-red-900"
          >
            Cancelar
          </button>
        </td>
      </template>
    </DataTable>

    <!-- Criação a partir de um pedido CONFIRMADO/EM SEPARAÇÃO, com quantidade por
         item — é o que dá suporte à expedição PARCIAL. -->
    <AppModal v-model="showCreateModal" size="lg" title="Criar Romaneio" @close="closeCreateModal">
      <form @submit.prevent="handleCreate" class="space-y-4">
        <FormField
          id="sh-form-order"
          label="Pedido de Venda"
          required
          hint="Só pedidos confirmados ou já em separação podem gerar romaneio"
        >
          <select
            v-model="createForm.salesOrderId"
            required
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            @change="handleOrderChange"
          >
            <option value="">Selecione...</option>
            <option v-for="order in shippableOrders" :key="order.id" :value="order.id">
              {{ order.orderNumber }} - {{ order.customer?.name ?? '' }}
            </option>
          </select>
        </FormField>

        <p v-if="shippableOrders.length === 0" class="text-sm text-gray-500">
          Nenhum pedido disponível para romanear. Confirme um pedido de venda primeiro.
        </p>

        <div v-if="selectedOrder">
          <h4 class="text-sm font-semibold text-gray-800 mb-2">Itens a expedir</h4>
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th scope="col" class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Produto</th>
                <th scope="col" class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Pedido</th>
                <th scope="col" class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Já expedido</th>
                <th scope="col" class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">A expedir</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              <tr v-for="line in createLines" :key="line.salesOrderItemId">
                <td class="px-3 py-2 text-sm text-gray-900">
                  {{ line.productCode }} - {{ line.productName }}
                </td>
                <td class="px-3 py-2 text-sm text-gray-500">{{ line.orderedQty }}</td>
                <td class="px-3 py-2 text-sm text-gray-500">{{ line.shippedQty }}</td>
                <td class="px-3 py-2">
                  <input
                    v-model.number="line.quantity"
                    :data-testid="`sh-form-qty-${line.salesOrderItemId}`"
                    type="number"
                    min="0"
                    :max="line.remainingQty"
                    step="0.01"
                    class="w-28 rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  />
                </td>
              </tr>
            </tbody>
          </table>
          <!--
            O saldo mostrado é `pedido - já expedido`. O teto REAL do backend
            desconta ainda o que outros romaneios ABERTOS já prometeram — dado
            que a listagem de pedidos não traz. Quem decide é o backend (400 com
            a conta detalhada); aqui a conta é só um ponto de partida razoável.
          -->
          <p class="text-xs text-gray-500 mt-2">
            O saldo exibido não desconta romaneios abertos do mesmo pedido — o servidor recusa a
            quantidade excedente com o saldo exato.
          </p>
        </div>

        <FormField id="sh-form-notes" label="Observações" hint="Até 500 caracteres">
          <input
            v-model="createForm.notes"
            type="text"
            maxlength="500"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
          />
        </FormField>

        <div class="flex gap-3 pt-4">
          <Button type="button" variant="outline" @click="closeCreateModal" class="flex-1">Cancelar</Button>
          <Button type="submit" :disabled="creating || !hasQuantityToShip" class="flex-1">
            {{ creating ? 'Criando...' : 'Criar Romaneio' }}
          </Button>
        </div>
      </form>
    </AppModal>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import AppLayout from '@/components/common/AppLayout.vue';
import AppModal from '@/components/common/AppModal.vue';
import Button from '@/components/common/Button.vue';
import Card from '@/components/common/Card.vue';
import DataTable from '@/components/common/DataTable.vue';
import type { Pagination } from '@/components/common/DataTable.vue';
import FormField from '@/components/common/FormField.vue';
import StatusBadge, { type BadgeTone } from '@/components/common/StatusBadge.vue';
import { confirmDialog } from '@/composables/useConfirm';
import { useToast } from '@/composables/useToast';
import { useSalesOrderStore } from '@/stores/sales-order.store';
import { useShipmentStore } from '@/stores/shipment.store';
import { useWarehouseStore } from '@/stores/warehouse.store';
import {
  SHIPMENT_STATUSES,
  SHIPMENT_STATUS_LABELS,
  type SalesOrder,
  type Shipment,
  type ShipmentStatus,
} from '@/types/sales.types';
import type { ApiError, Warehouse } from '@/types/warehouse.types';

const shipmentStore = useShipmentStore();
const salesOrderStore = useSalesOrderStore();
const warehouseStore = useWarehouseStore();
const toast = useToast();
const route = useRoute();

const shipments = ref<Shipment[]>([]);
const warehouses = ref<Warehouse[]>([]);
const shippableOrders = ref<SalesOrder[]>([]);

const loading = ref(false);
const error = ref('');
const creating = ref(false);

const filters = ref({ status: '', warehouseId: '', salesOrderId: '' });
const pagination = ref<Pagination>({ page: 1, limit: 20, total: 0, pages: 0 });

const showCreateModal = ref(false);
const createForm = ref<{ salesOrderId: string; notes: string }>({ salesOrderId: '', notes: '' });

interface CreateLine {
  salesOrderItemId: string;
  productCode: string;
  productName: string;
  orderedQty: number;
  shippedQty: number;
  remainingQty: number;
  quantity: number;
}

const createLines = ref<CreateLine[]>([]);

const STATUS_TONES: Record<ShipmentStatus, BadgeTone> = {
  PENDING: 'neutral',
  SEPARATING: 'warning',
  READY: 'info',
  DISPATCHED: 'success',
  CANCELLED: 'danger',
};

const statusTone = (status: ShipmentStatus): BadgeTone => STATUS_TONES[status] ?? 'neutral';

// O backend recusa cancelar depois do despacho (e um já cancelado).
const canCancel = (shipment: Shipment) =>
  shipment.status !== 'DISPATCHED' && shipment.status !== 'CANCELLED';

const selectedOrder = computed(
  () => shippableOrders.value.find((order) => order.id === createForm.value.salesOrderId) ?? null
);

const hasQuantityToShip = computed(() =>
  createLines.value.some((line) => Number(line.quantity) > 0)
);

const loadShipments = async () => {
  loading.value = true;
  error.value = '';
  try {
    const result = await shipmentStore.fetchShipments(
      pagination.value.page,
      pagination.value.limit,
      {
        status: filters.value.status || undefined,
        warehouseId: filters.value.warehouseId || undefined,
        salesOrderId: filters.value.salesOrderId || undefined,
      }
    );
    shipments.value = result.items;
    pagination.value = result.pagination;
  } catch (e) {
    error.value = (e as ApiError).response?.data?.message || 'Erro ao carregar romaneios';
  } finally {
    loading.value = false;
  }
};

const loadLookups = async () => {
  try {
    const [orders] = await Promise.all([
      salesOrderStore.fetchShippableOrders(),
      warehouseStore.fetchWarehouses(),
    ]);
    shippableOrders.value = orders;
    warehouses.value = warehouseStore.warehouses;
  } catch (e) {
    toast.error((e as ApiError).response?.data?.message || 'Erro ao carregar dados auxiliares');
  }
};

const handleFilterChange = () => {
  pagination.value.page = 1;
  loadShipments();
};

const changePage = (page: number) => {
  pagination.value.page = page;
  loadShipments();
};

const openCreateModal = () => {
  createForm.value = { salesOrderId: '', notes: '' };
  createLines.value = [];
  showCreateModal.value = true;
};

const closeCreateModal = () => {
  showCreateModal.value = false;
  createForm.value = { salesOrderId: '', notes: '' };
  createLines.value = [];
};

const handleOrderChange = () => {
  const order = selectedOrder.value;
  if (!order) {
    createLines.value = [];
    return;
  }

  createLines.value = (order.items ?? []).map((item) => {
    const remaining = Math.max(0, item.quantity - item.shippedQty);
    return {
      salesOrderItemId: item.id,
      productCode: item.product?.code ?? item.productId,
      productName: item.product?.name ?? '',
      orderedQty: item.quantity,
      shippedQty: item.shippedQty,
      remainingQty: remaining,
      quantity: remaining,
    };
  });
};

const handleCreate = async () => {
  // Linha com 0 é "não expedir este item agora" — o backend recusa item com
  // quantidade não-positiva, então ela sai do payload em vez de ir como zero.
  const items = createLines.value
    .filter((line) => Number(line.quantity) > 0)
    .map((line) => ({ salesOrderItemId: line.salesOrderItemId, quantity: Number(line.quantity) }));

  if (items.length === 0) {
    toast.error('Informe a quantidade de pelo menos um item.');
    return;
  }

  creating.value = true;
  try {
    await shipmentStore.createShipment({
      salesOrderId: createForm.value.salesOrderId,
      notes: createForm.value.notes || null,
      items,
    });
    toast.success('Romaneio criado com sucesso!');
    closeCreateModal();
    await loadShipments();
  } catch (e) {
    toast.error((e as ApiError).response?.data?.message || 'Erro ao criar romaneio');
  } finally {
    creating.value = false;
  }
};

const handleCancel = async (shipment: Shipment) => {
  const confirmed = await confirmDialog(
    `Cancelar o romaneio ${shipment.shipmentNumber}? As tarefas de separação ainda abertas também serão canceladas.`,
    { title: 'Cancelar romaneio' }
  );
  if (!confirmed) return;

  try {
    await shipmentStore.cancelShipment(shipment.id);
    toast.success('Romaneio cancelado com sucesso!');
    await loadShipments();
  } catch (e) {
    toast.error((e as ApiError).response?.data?.message || 'Erro ao cancelar romaneio');
  }
};

const formatDateTime = (date: string | null) =>
  date ? new Date(date).toLocaleString('pt-BR') : '—';

onMounted(() => {
  // Chegando de "Romaneios" na tela de pedidos, o filtro já vem pronto na URL.
  const salesOrderId = route.query.salesOrderId;
  if (typeof salesOrderId === 'string' && salesOrderId) {
    filters.value.salesOrderId = salesOrderId;
  }
  loadShipments();
  loadLookups();
});
</script>
