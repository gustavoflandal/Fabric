<template>
  <div class="px-4 py-2 rounded-full border-2 border-gray-700 bg-gray-100 text-xs font-semibold shadow-sm">
    Entrada
    <Handle type="source" :position="Position.Right" />
  </div>
</template>

<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
</script>
