<template>
  <div
    class="px-3 py-2 rounded-lg border-2 bg-white text-xs font-semibold shadow-sm whitespace-nowrap"
    :class="isAlocacao ? 'border-green-500 bg-green-50' : 'border-primary-400'"
  >
    <Handle type="target" :position="Position.Left" />
    {{ ICONS[data.type] }} {{ WORKFLOW_NODE_LABELS[data.type] }}
    <Handle v-if="!isAlocacao" type="source" :position="Position.Right" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { WORKFLOW_NODE_LABELS } from '@/types/workflow.types'
import type { WorkflowNodeType } from '@/types/workflow.types'

const props = defineProps<{ data: { type: WorkflowNodeType } }>()

const ICONS: Record<string, string> = {
  DESCARGA: '📥',
  CONFERENCIA: '✅',
  ETIQUETAGEM: '🏷️',
  QUARENTENA: '⚠️',
  SEGREGACAO: '🔀',
  AMOSTRAGEM: '🧪',
  ALOCACAO: '📦',
}

const isAlocacao = computed(() => props.data.type === 'ALOCACAO')
</script>
