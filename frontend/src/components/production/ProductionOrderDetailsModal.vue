<template>
  <div v-if="modelValue && order" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" @click="close">
    <div class="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col" @click.stop>
      <!-- Header -->
      <div class="p-6 border-b border-gray-200">
        <div class="flex justify-between items-start">
          <div>
            <h3 class="text-2xl font-bold text-gray-900">{{ order.orderNumber }}</h3>
            <p class="text-sm text-gray-600 mt-1">{{ order.product?.code }} - {{ order.product?.name }}</p>
          </div>
          <button @click="close" class="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
        </div>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-6">
        <div v-if="loading" class="text-center py-12">
          <p class="text-gray-500">Carregando...</p>
        </div>

        <div v-else class="space-y-6">
          <!-- Informações Gerais -->
          <Card title="Informações Gerais">
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p class="text-sm text-gray-500">Status</p>
                <span :class="getStatusClass(order.status)" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-1">
                  {{ getStatusLabel(order.status) }}
                </span>
              </div>
              <div>
                <p class="text-sm text-gray-500">Quantidade</p>
                <p class="text-lg font-semibold text-gray-900">{{ order.quantity }}</p>
              </div>
              <div>
                <p class="text-sm text-gray-500">Produzido</p>
                <p class="text-lg font-semibold text-green-600">{{ order.producedQty }}</p>
              </div>
              <div>
                <p class="text-sm text-gray-500">Refugo</p>
                <p class="text-lg font-semibold text-red-600">{{ order.scrapQty }}</p>
              </div>
            </div>

            <div class="mt-4">
              <div class="flex justify-between text-sm mb-1">
                <span class="text-gray-600">Progresso</span>
                <span class="font-semibold">{{ Math.round((order.producedQty / order.quantity) * 100) }}%</span>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-3">
                <div
                  class="bg-green-600 h-3 rounded-full transition-all"
                  :style="{ width: `${Math.min((order.producedQty / order.quantity) * 100, 100)}%` }"
                ></div>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4 mt-4">
              <div>
                <p class="text-sm text-gray-500">Início Agendado</p>
                <p class="text-sm font-medium text-gray-900">{{ formatDateTime(order.scheduledStart) }}</p>
              </div>
              <div>
                <p class="text-sm text-gray-500">Fim Agendado</p>
                <p class="text-sm font-medium text-gray-900">{{ formatDateTime(order.scheduledEnd) }}</p>
              </div>
              <div v-if="order.actualStart">
                <p class="text-sm text-gray-500">Início Real</p>
                <p class="text-sm font-medium text-green-600">{{ formatDateTime(order.actualStart) }}</p>
              </div>
              <div v-if="order.actualEnd">
                <p class="text-sm text-gray-500">Fim Real</p>
                <p class="text-sm font-medium text-green-600">{{ formatDateTime(order.actualEnd) }}</p>
              </div>
            </div>

            <div v-if="order.notes" class="mt-4">
              <p class="text-sm text-gray-500">Observações</p>
              <p class="text-sm text-gray-700 mt-1">{{ order.notes }}</p>
            </div>
          </Card>

          <!-- Materiais Necessários -->
          <Card title="Materiais Necessários">
            <div v-if="loadingMaterials" class="text-center py-8">
              <p class="text-gray-500">Carregando materiais...</p>
            </div>
            <div v-else-if="materials && materials.materials && materials.materials.length > 0">
              <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
                      <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Componente</th>
                      <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qtd/Un</th>
                      <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qtd Total</th>
                      <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Unidade</th>
                      <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Refugo</th>
                    </tr>
                  </thead>
                  <tbody class="bg-white divide-y divide-gray-200">
                    <tr v-for="(material, index) in materials.materials" :key="index">
                      <td class="px-4 py-2 text-sm text-gray-900">{{ material.componentCode }}</td>
                      <td class="px-4 py-2 text-sm text-gray-900">{{ material.componentName }}</td>
                      <td class="px-4 py-2 text-sm text-right text-gray-600">{{ material.quantityPerUnit }}</td>
                      <td class="px-4 py-2 text-sm text-right font-semibold text-gray-900">{{ material.totalQuantity.toFixed(2) }}</td>
                      <td class="px-4 py-2 text-sm text-gray-600">{{ material.unitCode }}</td>
                      <td class="px-4 py-2 text-sm text-right text-gray-500">{{ (material.scrapFactor * 100).toFixed(1) }}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div class="mt-2 text-xs text-gray-500">
                <p>BOM Versão: {{ materials.bomVersion }} (ID: {{ materials.bomId?.substring(0, 8) }}...)</p>
              </div>
            </div>
            <div v-else class="text-center py-8">
              <p class="text-gray-500">Produto não possui BOM ativa</p>
            </div>
          </Card>

          <!-- Operações -->
          <Card title="Operações de Produção">
            <div v-if="loadingOperations" class="text-center py-8">
              <p class="text-gray-500">Carregando operações...</p>
            </div>
            <div v-else-if="operations && operations.length > 0">
              <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Seq</th>
                      <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Centro</th>
                      <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Descrição</th>
                      <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Planejado</th>
                      <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Concluído</th>
                      <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Tempo (min)</th>
                      <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody class="bg-white divide-y divide-gray-200">
                    <tr v-for="op in operations" :key="op.id">
                      <td class="px-4 py-2 text-sm text-gray-900">{{ op.sequence }}</td>
                      <td class="px-4 py-2 text-sm text-gray-900">{{ op.workCenter?.code }}</td>
                      <td class="px-4 py-2 text-sm text-gray-600">{{ op.description }}</td>
                      <td class="px-4 py-2 text-sm text-right text-gray-900">{{ op.plannedQty }}</td>
                      <td class="px-4 py-2 text-sm text-right font-semibold text-green-600">{{ op.completedQty }}</td>
                      <td class="px-4 py-2 text-sm text-right text-gray-600">
                        {{ op.totalPlannedTime.toFixed(0) }}
                        <span v-if="op.actualTime > 0" class="text-xs text-gray-400">({{ op.actualTime.toFixed(0) }})</span>
                      </td>
                      <td class="px-4 py-2">
                        <span :class="getOperationStatusClass(op.status)" class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium">
                          {{ getOperationStatusLabel(op.status) }}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div v-else class="text-center py-8">
              <p class="text-gray-500">Produto não possui roteiro ativo</p>
            </div>
          </Card>

          <!-- Ações -->
          <Card title="Ações">
            <div class="space-y-4">
              <!-- Mudança de Status -->
              <div v-if="order.status !== 'COMPLETED' && order.status !== 'CANCELLED'">
                <label class="block text-sm font-medium text-gray-700 mb-2">Mudar Status</label>
                <div class="flex gap-2">
                  <Button v-if="order.status === 'PLANNED'" @click="changeStatus('RELEASED')" variant="primary" size="sm">
                    Liberar Ordem
                  </Button>
                  <Button v-if="order.status === 'RELEASED'" @click="changeStatus('IN_PROGRESS')" variant="success" size="sm">
                    Iniciar Produção
                  </Button>
                  <Button v-if="order.status === 'IN_PROGRESS'" @click="changeStatus('COMPLETED')" variant="success" size="sm">
                    Concluir Ordem
                  </Button>
                  <Button @click="changeStatus('CANCELLED')" variant="danger" size="sm">
                    Cancelar Ordem
                  </Button>
                </div>
              </div>

              <!-- Atualizar Progresso -->
              <div v-if="order.status === 'IN_PROGRESS'">
                <label class="block text-sm font-medium text-gray-700 mb-2">Atualizar Progresso</label>
                <div class="flex gap-3">
                  <div class="flex-1">
                    <label class="block text-xs text-gray-600 mb-1">Quantidade Produzida</label>
                    <input
                      v-model.number="progressForm.producedQty"
                      type="number"
                      min="0"
                      :max="order.quantity"
                      class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                    />
                  </div>
                  <div class="flex-1">
                    <label class="block text-xs text-gray-600 mb-1">Refugo</label>
                    <input
                      v-model.number="progressForm.scrapQty"
                      type="number"
                      min="0"
                      class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                    />
                  </div>
                  <div class="flex items-end">
                    <Button @click="updateProgress" :disabled="loading">Atualizar</Button>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import Button from '@/components/common/Button.vue';
import Card from '@/components/common/Card.vue';
import { useProductionOrderStore } from '@/stores/production-order.store';
import type { ProductionOrder } from '@/services/production-order.service';

const props = defineProps<{
  modelValue: boolean;
  order: ProductionOrder | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'refresh': [];
}>();

const orderStore = useProductionOrderStore();

const loading = ref(false);
const loadingMaterials = ref(false);
const loadingOperations = ref(false);
const materials = ref<any>(null);
const operations = ref<any[]>([]);
const progressForm = ref({
  producedQty: 0,
  scrapQty: 0,
});

const close = () => {
  emit('update:modelValue', false);
};

const loadMaterials = async () => {
  if (!props.order) return;
  loadingMaterials.value = true;
  try {
    materials.value = await orderStore.getMaterials(props.order.id);
  } catch (error) {
    console.error('Erro ao carregar materiais:', error);
  } finally {
    loadingMaterials.value = false;
  }
};

const loadOperations = async () => {
  if (!props.order) return;
  loadingOperations.value = true;
  try {
    operations.value = await orderStore.getOperations(props.order.id);
  } catch (error) {
    console.error('Erro ao carregar operações:', error);
  } finally {
    loadingOperations.value = false;
  }
};

const changeStatus = async (newStatus: string) => {
  if (!props.order) return;
  if (!confirm(`Deseja realmente mudar o status para ${getStatusLabel(newStatus)}?`)) return;

  try {
    await orderStore.changeStatus(props.order.id, newStatus);
    alert('Status atualizado com sucesso!');
    emit('refresh');
    close();
  } catch (error: any) {
    alert(error.response?.data?.message || 'Erro ao mudar status');
  }
};

const updateProgress = async () => {
  if (!props.order) return;

  try {
    await orderStore.updateProgress(props.order.id, progressForm.value.producedQty, progressForm.value.scrapQty);
    alert('Progresso atualizado com sucesso!');
    emit('refresh');
    close();
  } catch (error: any) {
    alert(error.response?.data?.message || 'Erro ao atualizar progresso');
  }
};

const getStatusClass = (status: string) => {
  const classes: Record<string, string> = {
    PLANNED: 'bg-blue-100 text-blue-800',
    RELEASED: 'bg-purple-100 text-purple-800',
    IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
    COMPLETED: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-red-100 text-red-800',
  };
  return classes[status] || 'bg-gray-100 text-gray-800';
};

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    PLANNED: 'Planejada',
    RELEASED: 'Liberada',
    IN_PROGRESS: 'Em Progresso',
    COMPLETED: 'Concluída',
    CANCELLED: 'Cancelada',
  };
  return labels[status] || status;
};

const getOperationStatusClass = (status: string) => {
  const classes: Record<string, string> = {
    PENDING: 'bg-gray-100 text-gray-700',
    IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
    COMPLETED: 'bg-green-100 text-green-800',
  };
  return classes[status] || 'bg-gray-100 text-gray-700';
};

const getOperationStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    PENDING: 'Pendente',
    IN_PROGRESS: 'Em Progresso',
    COMPLETED: 'Concluída',
  };
  return labels[status] || status;
};

const formatDateTime = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

watch(
  () => props.modelValue,
  async (newValue) => {
    if (newValue && props.order) {
      progressForm.value.producedQty = props.order.producedQty;
      progressForm.value.scrapQty = props.order.scrapQty;
      await Promise.all([loadMaterials(), loadOperations()]);
    }
  },
  { immediate: true }
);
</script>
