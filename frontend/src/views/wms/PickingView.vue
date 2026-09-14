<template>
  <AppLayout title="Picking" subtitle="Separação de Pedidos — WMS">
    <template #actions>
      <div class="flex gap-2">
        <button
          type="button"
          class="px-3 py-1.5 text-sm rounded-md"
          :class="showAll ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700'"
          @click="setShowAll(true)"
        >
          Todas
        </button>
        <button
          type="button"
          class="px-3 py-1.5 text-sm rounded-md"
          :class="!showAll ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700'"
          @click="setShowAll(false)"
        >
          Minhas tarefas
        </button>
      </div>
    </template>

    <div v-if="error" class="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
      <p>{{ error }}</p>
      <button
        type="button"
        class="mt-2 text-sm font-medium text-red-700 underline"
        @click="load"
      >
        Tentar Novamente
      </button>
    </div>

    <div v-if="loading && tasks.length === 0" class="text-center py-12 text-gray-500">
      Carregando...
    </div>

    <div v-else-if="pickingTasks.length === 0 && !error" class="text-center py-12 text-gray-500">
      Nenhuma tarefa de separação no momento.
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="task in pickingTasks"
        :key="task.id"
        class="border border-gray-200 rounded-lg p-4 bg-white dark:bg-gray-800 dark:border-gray-700"
      >
        <div class="flex justify-between items-start mb-2">
          <div>
            <p class="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {{ task.product?.code ?? task.productId }}
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ task.product?.name ?? '—' }}</p>
          </div>
          <StatusBadge :label="statusLabel(task.status)" :tone="statusTone(task.status)" />
        </div>

        <dl class="text-sm text-gray-700 dark:text-gray-300 space-y-1 mb-3">
          <div class="flex justify-between">
            <dt class="text-gray-500 dark:text-gray-400">Quantidade</dt>
            <dd class="font-medium">{{ task.quantity }}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-gray-500 dark:text-gray-400">Origem</dt>
            <dd class="font-medium">{{ task.fromPosition?.code ?? '—' }}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-gray-500 dark:text-gray-400">Prioridade</dt>
            <dd class="font-medium">{{ task.priority }}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-gray-500 dark:text-gray-400">Responsável</dt>
            <dd class="font-medium">{{ responsavelLabel(task) }}</dd>
          </div>
        </dl>

        <div class="pt-2 border-t border-gray-100 dark:border-gray-700">
          <Button
            v-if="canStart(task)"
            variant="primary"
            size="sm"
            full-width
            @click="handleStart(task)"
          >
            Iniciar
          </Button>
          <Button
            v-else-if="canExecute(task)"
            variant="success"
            size="sm"
            full-width
            @click="openExecuteModal(task)"
          >
            Confirmar Separação
          </Button>
          <p v-else-if="task.status === 'IN_PROGRESS'" class="text-xs text-gray-500 dark:text-gray-400 text-center">
            Com {{ responsavelLabel(task) }}
          </p>
        </div>
      </div>
    </div>

    <!-- Confirmação de execução (baixa de estoque) — modal próprio, NÃO reaproveita
         SimpleTaskActionModal (aquele é acoplado ao fluxo de Recebimento/`complete()`). -->
    <AppModal v-model="executeModalOpen" title="Confirmar Separação" size="sm">
      <div v-if="taskToExecute" class="text-sm text-gray-700 space-y-2">
        <p>
          <strong>Produto:</strong>
          {{ taskToExecute.product?.code ?? taskToExecute.productId }} —
          {{ taskToExecute.product?.name ?? '—' }}
        </p>
        <p><strong>Quantidade:</strong> {{ taskToExecute.quantity }}</p>
        <p><strong>Posição de origem:</strong> {{ taskToExecute.fromPosition?.code ?? '—' }}</p>
        <p class="text-gray-500 text-xs pt-2">
          Ao confirmar, o estoque será baixado da posição de origem.
        </p>
      </div>
      <template #footer>
        <div class="flex justify-end gap-3">
          <button type="button" class="px-4 py-2 text-sm text-gray-700" @click="executeModalOpen = false">
            Cancelar
          </button>
          <Button variant="success" :loading="executing" @click="confirmExecute">
            Confirmar Separação
          </Button>
        </div>
      </template>
    </AppModal>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import AppLayout from '@/components/common/AppLayout.vue'
import AppModal from '@/components/common/AppModal.vue'
import Button from '@/components/common/Button.vue'
import StatusBadge, { type BadgeTone } from '@/components/common/StatusBadge.vue'
import { useAuthStore } from '@/stores/auth.store'
import { useToast } from '@/composables/useToast'
import { confirmDialog } from '@/composables/useConfirm'
import warehouseTaskService from '@/services/warehouse-task.service'
import {
  WAREHOUSE_TASK_STATUS_LABELS,
  WAREHOUSE_TASK_STATUS_TONES,
} from '@/types/warehouse-task.types'
import type { WarehouseTask, WarehouseTaskStatus } from '@/types/warehouse-task.types'
import type { ApiError } from '@/types/warehouse.types'

const authStore = useAuthStore()
const toast = useToast()

const tasks = ref<WarehouseTask[]>([])
const loading = ref(false)
const error = ref('')
const showAll = ref(true)

const userId = computed(() => authStore.user?.id ?? null)

// Só PICKING nesta tela — o backend não filtra por `type` em `/warehouse-tasks/my`
// (ele também devolve REPLENISHMENT e o restante das etapas de recebimento em
// aberto), então o filtro é feito aqui.
const pickingTasks = computed(() => tasks.value.filter((task) => task.type === 'PICKING'))

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const response = await warehouseTaskService.getMyTasks({
      includeUnassigned: showAll.value,
      limit: 100,
    })
    tasks.value = response.data.data || []
  } catch (err) {
    error.value = (err as ApiError).response?.data?.message || 'Não foi possível carregar as tarefas de separação.'
  } finally {
    loading.value = false
  }
}

function setShowAll(value: boolean): void {
  if (showAll.value === value) return
  showAll.value = value
  load()
}

// Rótulo/tom vêm de `warehouse-task.types.ts` — a tela de detalhe do romaneio
// exibe as mesmas tarefas de separação e usa exatamente estes mapas.
function statusLabel(status: WarehouseTaskStatus): string {
  return WAREHOUSE_TASK_STATUS_LABELS[status] ?? status
}

function statusTone(status: WarehouseTaskStatus): BadgeTone {
  return WAREHOUSE_TASK_STATUS_TONES[status] ?? 'neutral'
}

// `GET /warehouse-tasks/my` hoje não seleciona a relação `assignee` (só
// `assignedTo`) — ver a nota em warehouse-task.types.ts. Por isso o rótulo cai
// para "Você"/"Não atribuído" quando o nome não vier, em vez de mostrar vazio.
function responsavelLabel(task: WarehouseTask): string {
  if (task.assignee?.name) return task.assignee.name
  if (task.assignedTo === null) return 'Não atribuído'
  if (task.assignedTo === userId.value) return 'Você'
  return 'Outro operador'
}

function canStart(task: WarehouseTask): boolean {
  return (
    task.status === 'PENDING' &&
    (task.assignedTo === null || task.assignedTo === userId.value)
  )
}

function canExecute(task: WarehouseTask): boolean {
  return task.status === 'IN_PROGRESS' && task.assignedTo === userId.value
}

async function handleStart(task: WarehouseTask): Promise<void> {
  const confirmed = await confirmDialog(
    `Iniciar a separação de "${task.product?.code ?? task.productId}"?`,
    { title: 'Iniciar tarefa' }
  )
  if (!confirmed) return

  try {
    await warehouseTaskService.start(task.id)
    await load()
  } catch (err) {
    toast.error((err as ApiError).response?.data?.message || 'Não foi possível iniciar a tarefa.')
  }
}

// ---- Modal de confirmação de execução (baixa de estoque) -------------------
const executeModalOpen = ref(false)
const taskToExecute = ref<WarehouseTask | null>(null)
const executing = ref(false)

function openExecuteModal(task: WarehouseTask): void {
  taskToExecute.value = task
  executeModalOpen.value = true
}

async function confirmExecute(): Promise<void> {
  if (!taskToExecute.value) return
  const taskId = taskToExecute.value.id
  const version = taskToExecute.value.version

  executing.value = true
  try {
    await warehouseTaskService.execute(taskId, version)
    toast.success('Separação registrada, estoque baixado.')
    executeModalOpen.value = false
    taskToExecute.value = null
    await load()
  } catch (err) {
    // Ex.: 409 por concorrência (outra pessoa alterou a tarefa) — mostra a
    // mensagem do backend e recarrega a lista para refletir o estado atual.
    toast.error((err as ApiError).response?.data?.message || 'Não foi possível registrar a separação.')
    await load()
  } finally {
    executing.value = false
  }
}

onMounted(() => {
  load()
})
</script>
