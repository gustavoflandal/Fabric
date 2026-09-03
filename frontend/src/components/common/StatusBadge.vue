<template>
  <span :class="badgeClasses">{{ label }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export type BadgeTone = 'success' | 'danger' | 'warning' | 'neutral' | 'info'

interface Props {
  label: string
  tone?: BadgeTone
}

const props = withDefaults(defineProps<Props>(), {
  tone: 'neutral',
})

// Pares bg/text ja usados no sistema (SuppliersView.vue:98, UsersListView.vue:113-118,
// CountingPlanList.vue:301-307, PurchaseOrdersView.vue:345). §4.2: green = sucesso,
// red = perigo, yellow = alerta, gray = neutro, blue = informativo.
const TONES: Record<BadgeTone, string> = {
  success: 'bg-green-100 text-green-800',
  danger: 'bg-red-100 text-red-800',
  warning: 'bg-yellow-100 text-yellow-800',
  neutral: 'bg-gray-100 text-gray-800',
  info: 'bg-blue-100 text-blue-800',
}

const BASE = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium'

const badgeClasses = computed(() => `${BASE} ${TONES[props.tone] ?? TONES.neutral}`)
</script>
