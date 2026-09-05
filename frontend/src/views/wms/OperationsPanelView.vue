<template>
  <AppLayout title="Operações Ativas" subtitle="Recebimento — WMS">
    <template #actions>
      <div class="flex gap-2">
        <button
          type="button"
          class="px-3 py-1.5 text-sm rounded-md"
          :class="scope === 'all' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700'"
          @click="setScope('all')"
        >
          Todas
        </button>
        <button
          type="button"
          class="px-3 py-1.5 text-sm rounded-md"
          :class="scope === 'mine' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700'"
          @click="setScope('mine')"
        >
          Minhas
        </button>
      </div>
    </template>

    <div v-if="store.error" class="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
      {{ store.error }}
    </div>

    <div v-if="store.loading && store.operations.length === 0" class="text-center py-12 text-gray-500">
      Carregando...
    </div>

    <div v-else-if="store.operations.length === 0" class="text-center py-12 text-gray-500">
      Nenhuma operação ativa {{ scope === 'mine' ? 'para você' : '' }} no momento.
    </div>

    <div v-else class="space-y-4">
      <div v-for="operation in store.operations" :key="operation.receiptId" class="border border-gray-200 rounded-lg p-4">
        <p class="text-sm font-medium text-gray-700 mb-3">{{ operation.receiptNumber }}</p>
        <div class="flex gap-2 flex-wrap">
          <TaskRectangle
            v-for="task in operation.tasks"
            :key="task.id"
            :task="task"
            :state="computeTaskRectangleState(operation.tasks, task, authStore.user?.id ?? '')"
            @click="handleRectangleClick(operation, task)"
          />
        </div>
      </div>
    </div>

    <!-- Confirmação de "pegar tarefa" -->
    <AppModal v-model="confirmPickupOpen" title="Pegar esta tarefa?" size="sm">
      <p class="text-sm text-gray-700">
        Você vai assumir a etapa <strong>{{ pendingTask ? WAREHOUSE_TASK_TYPE_LABELS[pendingTask.type] : '' }}</strong>.
      </p>
      <div v-if="pickupErrorMessage" class="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
        {{ pickupErrorMessage }}
      </div>
      <template #footer>
        <div class="flex justify-end gap-3">
          <button type="button" class="px-4 py-2 text-sm text-gray-700" @click="confirmPickupOpen = false">Cancelar</button>
          <button type="button" class="px-4 py-2 text-sm bg-primary-600 text-white rounded-md" @click="confirmPickup">
            Pegar tarefa
          </button>
        </div>
      </template>
    </AppModal>

    <!-- Detalhe só-leitura (concluída, ou ativa de outro operador) -->
    <AppModal v-model="detailOpen" title="Detalhe da etapa" size="sm">
      <div v-if="detailTask" class="text-sm text-gray-700 space-y-2">
        <p><strong>Tipo:</strong> {{ WAREHOUSE_TASK_TYPE_LABELS[detailTask.type] }}</p>
        <p><strong>Status:</strong> {{ detailTask.status }}</p>
        <p v-if="detailTask.assignee"><strong>Responsável:</strong> {{ detailTask.assignee.name }}</p>
        <p v-if="detailTask.completedAt"><strong>Concluída em:</strong> {{ new Date(detailTask.completedAt).toLocaleString('pt-BR') }}</p>
      </div>
    </AppModal>

    <SimpleTaskActionModal
      v-if="actionOperation && actionTask && actionTask.type !== 'ALOCACAO'"
      v-model="simpleActionOpen"
      :task="actionTask"
      :receipt-number="actionOperation.receiptNumber"
      :supplier-name="actionSupplierName"
      :items="actionItems"
      @completed="handleActionCompleted"
    />

    <PutawayActionModal
      v-if="actionOperation && actionTask && actionTask.type === 'ALOCACAO'"
      v-model="putawayActionOpen"
      :task="actionTask"
      :receipt-number="actionOperation.receiptNumber"
      :supplier-name="actionSupplierName"
      :items="actionItems"
      @completed="handleActionCompleted"
    />
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '@/components/common/AppLayout.vue'
import AppModal from '@/components/common/AppModal.vue'
import TaskRectangle from '@/components/wms/TaskRectangle.vue'
import SimpleTaskActionModal from '@/components/wms/SimpleTaskActionModal.vue'
import PutawayActionModal from '@/components/wms/PutawayActionModal.vue'
import { computeTaskRectangleState } from '@/components/wms/task-rectangle-state'
import { toOperationItems } from './operations-panel-items'
import { useWarehouseTaskPanelStore } from '@/stores/warehouse-task-panel.store'
import { useAuthStore } from '@/stores/auth.store'
import warehouseTaskService from '@/services/warehouse-task.service'
import purchaseReceiptService from '@/services/purchase-receipt.service'
import { WAREHOUSE_TASK_TYPE_LABELS } from '@/types/warehouse-task.types'
import type { WarehouseTask, ReceiptOperation, PanelScope } from '@/types/warehouse-task.types'
import type { OperationItemForDocument } from './operations-panel-items'

const POLL_INTERVAL_MS = 25000

const route = useRoute()
const router = useRouter()
const store = useWarehouseTaskPanelStore()
const authStore = useAuthStore()

const scope = computed<PanelScope>(() => (route.query.scope === 'mine' ? 'mine' : 'all'))

function setScope(next: PanelScope): void {
  router.replace({ query: { ...route.query, scope: next } })
}

let pollHandle: ReturnType<typeof setInterval> | undefined

async function load(): Promise<void> {
  try {
    await store.fetchPanel(scope.value)
  } catch {
    // store.fetchPanel já registra a mensagem em store.error, que o template
    // exibe (v-if="store.error") — nada mais a fazer aqui além de evitar a
    // unhandled promise rejection.
  }
}

onMounted(() => {
  load()
  pollHandle = setInterval(load, POLL_INTERVAL_MS)
})

onUnmounted(() => {
  if (pollHandle) clearInterval(pollHandle)
})

// Recarrega quando o usuário troca de aba (scope), sem esperar o próximo poll.
watch(scope, load)

// ---- Confirmação de "pegar tarefa" -------------------------------------
const confirmPickupOpen = ref(false)
const pendingOperation = ref<ReceiptOperation | null>(null)
const pendingTask = ref<WarehouseTask | null>(null)

// ---- Detalhe só-leitura ---------------------------------------------------
const detailOpen = ref(false)
const detailTask = ref<WarehouseTask | null>(null)

// ---- Modal de ação (simples ou Alocação) ----------------------------------
const simpleActionOpen = ref(false)
const putawayActionOpen = ref(false)
const actionOperation = ref<ReceiptOperation | null>(null)
const actionTask = ref<WarehouseTask | null>(null)
const actionItems = ref<OperationItemForDocument[]>([])
const actionSupplierName = ref('')
const pickupErrorMessage = ref('')

function handleRectangleClick(operation: ReceiptOperation, task: WarehouseTask): void {
  const state = computeTaskRectangleState(operation.tasks, task, authStore.user?.id ?? '')

  if (state === 'completed' || state === 'active-other') {
    detailTask.value = task
    detailOpen.value = true
    return
  }

  if (state !== 'active-mine') return

  if (task.assignedTo === null) {
    pendingOperation.value = operation
    pendingTask.value = task
    pickupErrorMessage.value = ''
    confirmPickupOpen.value = true
    return
  }

  openAction(operation, task)
}

async function confirmPickup(): Promise<void> {
  if (!pendingTask.value || !pendingOperation.value) return
  const taskId = pendingTask.value.id
  const receiptId = pendingOperation.value.receiptId

  try {
    await warehouseTaskService.start(taskId)
  } catch (error: any) {
    pickupErrorMessage.value =
      error?.response?.data?.message ?? 'Não foi possível assumir esta tarefa.'
    return
  }

  pickupErrorMessage.value = ''
  confirmPickupOpen.value = false
  pendingOperation.value = null
  pendingTask.value = null
  await load()

  // Reabre com os dados atualizados (assignedTo/status pós-start), não com a
  // referência antiga capturada antes do POST /start.
  const operation = store.operations.find((op) => op.receiptId === receiptId)
  const task = operation?.tasks.find((t) => t.id === taskId)
  if (operation && task) {
    openAction(operation, task)
  }
}

async function openAction(operation: ReceiptOperation, task: WarehouseTask): Promise<void> {
  try {
    const response = await purchaseReceiptService.getById(operation.receiptId)
    const receipt = response.data.data
    actionOperation.value = operation
    actionTask.value = task
    actionItems.value = toOperationItems(
      receipt.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        quantity: item.acceptedQty,
        lotNumber: item.lotNumber,
        product: item.product,
      }))
    )
    actionSupplierName.value = receipt.order?.supplier?.name ?? ''

    if (task.type === 'ALOCACAO') {
      putawayActionOpen.value = true
    } else {
      simpleActionOpen.value = true
    }
  } catch (error: any) {
    const serverMessage = error?.response?.data?.message
    store.error = serverMessage
      ? `Não foi possível carregar os detalhes do recebimento. ${serverMessage}`
      : 'Não foi possível carregar os detalhes do recebimento.'
  }
}

function handleActionCompleted(): void {
  load()
}
</script>
