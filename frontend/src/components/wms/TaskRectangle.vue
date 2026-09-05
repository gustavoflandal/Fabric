<template>
  <button
    type="button"
    class="px-3 py-2 rounded-lg border-2 text-xs font-semibold whitespace-nowrap transition-colors"
    :class="classesByState[state]"
    :disabled="state === 'locked'"
    @click="emit('click')"
  >
    {{ WAREHOUSE_TASK_TYPE_LABELS[task.type] }}
    <span v-if="state === 'completed'" aria-hidden="true">✓</span>
  </button>
</template>

<script setup lang="ts">
import { WAREHOUSE_TASK_TYPE_LABELS } from '@/types/warehouse-task.types'
import type { WarehouseTask } from '@/types/warehouse-task.types'
import type { RectangleState } from './task-rectangle-state'

defineProps<{ task: WarehouseTask; state: RectangleState }>()
const emit = defineEmits<{ click: [] }>()

const classesByState: Record<RectangleState, string> = {
  completed: 'border-green-500 bg-green-50 text-green-800 cursor-pointer hover:bg-green-100',
  'active-mine': 'border-primary-500 bg-primary-50 text-primary-800 cursor-pointer hover:bg-primary-100 ring-2 ring-primary-300',
  'active-other': 'border-yellow-500 bg-yellow-50 text-yellow-800 cursor-pointer hover:bg-yellow-100',
  locked: 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed',
}
</script>
