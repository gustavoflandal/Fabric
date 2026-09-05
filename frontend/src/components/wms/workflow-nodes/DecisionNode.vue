<template>
  <div class="px-3 py-2 rounded-lg border-2 border-purple-400 bg-purple-50 text-xs font-semibold shadow-sm whitespace-nowrap">
    <Handle type="target" :position="Position.Left" />
    🔶 {{ data.label || 'Decisão' }}
    <Handle id="SIM" type="source" :position="Position.Bottom" style="left: 30%; background: #16a34a" />
    <Handle id="NAO" type="source" :position="Position.Bottom" style="left: 70%; background: #dc2626" />
  </div>
</template>

<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'

defineProps<{ data: { label: string | null } }>()
</script>
