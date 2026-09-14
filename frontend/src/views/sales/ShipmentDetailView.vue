<template>
  <AppLayout
    :title="shipment ? `Romaneio ${shipment.shipmentNumber}` : 'Romaneio'"
    subtitle="Itens, progresso da separação e despacho"
  >
    <template #actions>
      <div class="flex gap-2">
        <Button variant="outline" @click="goBack">Voltar</Button>
        <Button
          v-if="shipment && shipment.status === 'PENDING'"
          :loading="acting"
          @click="handleStartSeparation"
        >
          Iniciar Separação
        </Button>
        <!--
          "Despachar" só aparece no status certo e só fica HABILITADO quando
          todas as tarefas de separação estão concluídas — é exatamente o gate
          do backend (`dispatch`), replicado aqui só para não oferecer um botão
          que vai voltar 400. Zero tarefa também barra.
        -->
        <Button
          v-if="shipment && canDispatchStatus"
          variant="success"
          :disabled="!allTasksCompleted"
          :loading="acting"
          :title="allTasksCompleted ? 'Confirmar a saída do romaneio' : 'Conclua todas as tarefas de separação antes de despachar'"
          @click="handleDispatch"
        >
          Despachar
        </Button>
        <Button
          v-if="shipment && canCancel"
          variant="danger"
          :loading="acting"
          @click="handleCancel"
        >
          Cancelar
        </Button>
      </div>
    </template>

    <div v-if="error" class="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
      <p>{{ error }}</p>
      <button type="button" class="mt-2 text-sm font-medium text-red-700 underline" @click="load">
        Tentar Novamente
      </button>
    </div>

    <div v-if="loading && !shipment" class="text-center py-12 text-gray-500">Carregando...</div>

    <template v-else-if="shipment">
      <Card class="mb-6">
        <dl class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <dt class="text-gray-500">Status</dt>
            <dd class="mt-1">
              <StatusBadge :label="SHIPMENT_STATUS_LABELS[shipment.status]" :tone="shipmentTone" />
            </dd>
          </div>
          <div>
            <dt class="text-gray-500">Pedido de Venda</dt>
            <dd class="mt-1 font-medium text-gray-900">{{ shipment.salesOrder?.orderNumber ?? '—' }}</dd>
          </div>
          <div>
            <dt class="text-gray-500">Cliente</dt>
            <dd class="mt-1 font-medium text-gray-900">{{ shipment.salesOrder?.customer?.name ?? '—' }}</dd>
          </div>
          <div>
            <dt class="text-gray-500">Armazém</dt>
            <dd class="mt-1 font-medium text-gray-900">{{ shipment.warehouse?.name ?? '—' }}</dd>
          </div>
          <div>
            <dt class="text-gray-500">Criado em</dt>
            <dd class="mt-1 font-medium text-gray-900">{{ formatDateTime(shipment.createdAt) }}</dd>
          </div>
          <div>
            <dt class="text-gray-500">Despachado em</dt>
            <dd class="mt-1 font-medium text-gray-900">{{ formatDateTime(shipment.dispatchedAt) }}</dd>
          </div>
          <div class="md:col-span-3">
            <dt class="text-gray-500">Observações</dt>
            <dd class="mt-1 text-gray-900">{{ shipment.notes || '—' }}</dd>
          </div>
        </dl>
      </Card>

      <h3 class="text-lg font-semibold text-gray-900 mb-2">Itens do Romaneio</h3>
      <DataTable
        class="mb-6"
        :items="shipment.items ?? []"
        empty-title="Romaneio sem itens"
        empty-hint="Um romaneio sem itens não pode ser separado."
      >
        <template #head>
          <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produto</th>
          <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantidade</th>
          <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pedido (item)</th>
          <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Já expedido</th>
          <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lote</th>
        </template>

        <template #row="{ item }">
          <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
            {{ item.product?.code ?? item.productId }} - {{ item.product?.name ?? '' }}
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
            {{ item.quantity }} {{ item.product?.unit?.symbol ?? '' }}
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ item.salesOrderItem?.quantity ?? '—' }}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ item.salesOrderItem?.shippedQty ?? '—' }}</td>
          <!-- Nasce nulo: o lote real de cada retirada fica na tarefa/movimento. -->
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ item.lot?.lotNumber ?? '—' }}</td>
        </template>
      </DataTable>

      <div class="flex items-center justify-between mb-2">
        <h3 class="text-lg font-semibold text-gray-900">Progresso da Separação</h3>
        <span class="text-sm text-gray-600">
          {{ completedTasksCount }} de {{ pickingTasks.length }} tarefa(s) concluída(s)
        </span>
      </div>

      <div v-if="pickingTasks.length > 0" class="w-full bg-gray-200 rounded-full h-2 mb-4">
        <div
          class="bg-primary-600 h-2 rounded-full transition-all"
          :style="{ width: `${progressPercent}%` }"
          data-testid="shipment-progress-bar"
        ></div>
      </div>

      <DataTable
        :items="pickingTasks"
        empty-title="Nenhuma tarefa de separação"
        empty-hint="As tarefas são geradas ao iniciar a separação do romaneio."
      >
        <template #head>
          <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produto</th>
          <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantidade</th>
          <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Origem</th>
          <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lote</th>
          <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Responsável</th>
          <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
        </template>

        <template #row="{ item }">
          <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
            {{ item.product?.code ?? item.productId }} - {{ item.product?.name ?? '' }}
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ item.quantity ?? '—' }}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ item.fromPosition?.code ?? '—' }}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ item.lot?.lotNumber ?? '—' }}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ item.assignee?.name ?? 'Não atribuído' }}</td>
          <td class="px-6 py-4 whitespace-nowrap">
            <StatusBadge :label="taskStatusLabel(item.status)" :tone="taskStatusTone(item.status)" />
          </td>
        </template>
      </DataTable>

      <p class="mt-3 text-xs text-gray-500">
        A execução das tarefas (iniciar/confirmar separação, com baixa de estoque) acontece na tela
        de Picking do WMS.
      </p>
    </template>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppLayout from '@/components/common/AppLayout.vue';
import Button from '@/components/common/Button.vue';
import Card from '@/components/common/Card.vue';
import DataTable from '@/components/common/DataTable.vue';
import StatusBadge, { type BadgeTone } from '@/components/common/StatusBadge.vue';
import { confirmDialog } from '@/composables/useConfirm';
import { useToast } from '@/composables/useToast';
import { useShipmentStore } from '@/stores/shipment.store';
import {
  SHIPMENT_STATUS_LABELS,
  type Shipment,
  type ShipmentPickingTask,
  type ShipmentStatus,
} from '@/types/sales.types';
import {
  WAREHOUSE_TASK_STATUS_LABELS,
  WAREHOUSE_TASK_STATUS_TONES,
  type WarehouseTaskStatus,
} from '@/types/warehouse-task.types';
import type { ApiError } from '@/types/warehouse.types';

const route = useRoute();
const router = useRouter();
const shipmentStore = useShipmentStore();
const toast = useToast();

const shipment = ref<Shipment | null>(null);
const loading = ref(false);
const error = ref('');
const acting = ref(false);

const shipmentId = computed(() => String(route.params.id ?? ''));

const STATUS_TONES: Record<ShipmentStatus, BadgeTone> = {
  PENDING: 'neutral',
  SEPARATING: 'warning',
  READY: 'info',
  DISPATCHED: 'success',
  CANCELLED: 'danger',
};

const shipmentTone = computed<BadgeTone>(() =>
  shipment.value ? STATUS_TONES[shipment.value.status] ?? 'neutral' : 'neutral'
);

// Rótulo/tom das tarefas vêm dos MESMOS mapas usados na tela de Picking
// (`warehouse-task.types.ts`) — a mesma tarefa não pode aparecer com nomes
// diferentes em duas telas.
const taskStatusLabel = (status: WarehouseTaskStatus) =>
  WAREHOUSE_TASK_STATUS_LABELS[status] ?? status;
const taskStatusTone = (status: WarehouseTaskStatus): BadgeTone =>
  WAREHOUSE_TASK_STATUS_TONES[status] ?? 'neutral';

/**
 * As tarefas já vêm embutidas no detalhe do romaneio (`GET /shipments/:id`
 * devolve `pickingTasks`, filtradas no backend por
 * `referenceType = 'SHIPMENT'` e `reference = shipment.id`) — não há uma
 * segunda chamada a `/warehouse-tasks` aqui.
 */
const pickingTasks = computed<ShipmentPickingTask[]>(() => shipment.value?.pickingTasks ?? []);

const completedTasksCount = computed(
  () => pickingTasks.value.filter((task) => task.status === 'COMPLETED').length
);

// ZERO tarefa NÃO conta como "tudo concluído" — é o mesmo guard do backend, que
// recusa despachar um romaneio que nunca foi separado.
const allTasksCompleted = computed(
  () => pickingTasks.value.length > 0 && completedTasksCount.value === pickingTasks.value.length
);

const progressPercent = computed(() =>
  pickingTasks.value.length === 0
    ? 0
    : Math.round((completedTasksCount.value / pickingTasks.value.length) * 100)
);

const canDispatchStatus = computed(
  () => shipment.value?.status === 'SEPARATING' || shipment.value?.status === 'READY'
);

const canCancel = computed(
  () => shipment.value?.status !== 'DISPATCHED' && shipment.value?.status !== 'CANCELLED'
);

const load = async () => {
  loading.value = true;
  error.value = '';
  try {
    shipment.value = await shipmentStore.getShipmentById(shipmentId.value);
  } catch (e) {
    error.value = (e as ApiError).response?.data?.message || 'Erro ao carregar o romaneio';
  } finally {
    loading.value = false;
  }
};

const goBack = () => {
  router.push('/shipments');
};

const handleStartSeparation = async () => {
  const confirmed = await confirmDialog(
    'Iniciar a separação deste romaneio? As tarefas de picking serão geradas para o armazém.',
    { title: 'Iniciar separação' }
  );
  if (!confirmed) return;

  acting.value = true;
  try {
    // As transições devolvem o romaneio já no shape do detalhe (com
    // `pickingTasks`), então o retorno substitui o estado direto — sem um
    // `getById` extra logo em seguida.
    shipment.value = await shipmentStore.startSeparation(shipmentId.value);
    toast.success('Separação iniciada e tarefas de picking geradas.');
  } catch (e) {
    toast.error((e as ApiError).response?.data?.message || 'Erro ao iniciar a separação');
    await load();
  } finally {
    acting.value = false;
  }
};

const handleDispatch = async () => {
  const confirmed = await confirmDialog(
    'Despachar este romaneio? A saída será registrada e as quantidades expedidas do pedido serão atualizadas.',
    { title: 'Despachar romaneio' }
  );
  if (!confirmed) return;

  acting.value = true;
  try {
    shipment.value = await shipmentStore.dispatchShipment(shipmentId.value);
    toast.success('Romaneio despachado com sucesso!');
  } catch (e) {
    toast.error((e as ApiError).response?.data?.message || 'Erro ao despachar o romaneio');
    await load();
  } finally {
    acting.value = false;
  }
};

const handleCancel = async () => {
  const confirmed = await confirmDialog(
    'Cancelar este romaneio? As tarefas de separação ainda abertas também serão canceladas.',
    { title: 'Cancelar romaneio' }
  );
  if (!confirmed) return;

  acting.value = true;
  try {
    shipment.value = await shipmentStore.cancelShipment(shipmentId.value);
    toast.success('Romaneio cancelado com sucesso!');
  } catch (e) {
    toast.error((e as ApiError).response?.data?.message || 'Erro ao cancelar o romaneio');
    await load();
  } finally {
    acting.value = false;
  }
};

const formatDateTime = (date: string | null) =>
  date ? new Date(date).toLocaleString('pt-BR') : '—';

onMounted(() => {
  load();
});
</script>
