<template>
  <AppModal :model-value="modelValue" title="Conduzir etapa" size="sm" @update:model-value="emit('update:modelValue', $event)">
    <p class="text-sm text-gray-700 mb-4">
      Confirmar a conclusão da etapa <strong>{{ WAREHOUSE_TASK_TYPE_LABELS[task.type] }}</strong>
      do recebimento <strong>{{ receiptNumber }}</strong>?
    </p>

    <div v-if="errorMessage" class="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
      {{ errorMessage }}
    </div>

    <button
      type="button"
      class="text-sm text-primary-600 hover:underline mb-4"
      @click="printSupportDocument"
    >
      🖨️ Imprimir documento de apoio
    </button>

    <template #footer>
      <div class="flex justify-end gap-3">
        <button type="button" class="px-4 py-2 text-sm text-gray-700" @click="emit('update:modelValue', false)">
          Cancelar
        </button>
        <button
          type="button"
          class="px-4 py-2 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
          :disabled="submitting"
          @click="handleConfirm"
        >
          {{ submitting ? 'Concluindo...' : 'Concluir etapa' }}
        </button>
      </div>
    </template>
  </AppModal>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import AppModal from '@/components/common/AppModal.vue'
import warehouseTaskService from '@/services/warehouse-task.service'
import { buildTaskSupportDocument } from '@/utils/task-support-document'
import { WAREHOUSE_TASK_TYPE_LABELS } from '@/types/warehouse-task.types'
import type { WarehouseTask } from '@/types/warehouse-task.types'
import type { TaskSupportDocumentItem } from '@/utils/task-support-document'

const props = defineProps<{
  modelValue: boolean
  task: WarehouseTask
  receiptNumber: string
  supplierName: string
  items: TaskSupportDocumentItem[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  completed: []
}>()

const submitting = ref(false)
const errorMessage = ref('')

function printSupportDocument(): void {
  const doc = buildTaskSupportDocument({
    taskType: props.task.type,
    receiptNumber: props.receiptNumber,
    supplierName: props.supplierName,
    items: props.items,
    positions: [],
  })
  doc.save(`${props.task.type.toLowerCase()}-${props.receiptNumber}.pdf`)
}

async function handleConfirm(): Promise<void> {
  submitting.value = true
  errorMessage.value = ''
  try {
    await warehouseTaskService.complete(props.task.id)
    emit('completed')
    emit('update:modelValue', false)
  } catch (error: any) {
    errorMessage.value = error?.response?.data?.message ?? 'Erro ao concluir a etapa.'
  } finally {
    submitting.value = false
  }
}
</script>
