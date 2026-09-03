<script lang="ts">
// Contador de MODULO (fora do <script setup>, que roda por instancia) —
// equivalente manual ao useId() do Vue 3.5; o projeto esta no 3.4.
let fieldCounter = 0
export function nextFieldId(): string {
  return `field-${++fieldCounter}`
}
</script>

<script setup lang="ts">
import { computed, onMounted, ref, watchEffect } from 'vue'

interface Props {
  /** Opcional: se nao vier, um id unico e gerado automaticamente. */
  id?: string
  label: string
  required?: boolean
  error?: string
  hint?: string
}

const props = withDefaults(defineProps<Props>(), {
  required: false,
})

const generatedId = nextFieldId()
const fieldId = computed(() => props.id || generatedId)

const controlWrapper = ref<HTMLElement | null>(null)

// §4.1-3 / §4.4-7: errar o for/id e invisivel para quem revisa, entao o componente
// acerta sozinho. O consumidor pode aplicar :id="id" via slot prop; se nao aplicar,
// o id e colado no primeiro controle do slot que ainda nao tenha um.
function bindControlId(): void {
  const control = controlWrapper.value?.querySelector<HTMLElement>(
    'input, select, textarea'
  )
  if (control && !control.id) {
    control.id = fieldId.value
  }
}

onMounted(bindControlId)
watchEffect(bindControlId)

defineExpose({ fieldId })
</script>

<template>
  <div class="w-full">
    <label :for="fieldId" class="block text-sm font-medium text-gray-700 mb-1">
      {{ label }}
      <span v-if="required" class="text-red-500">*</span>
    </label>

    <div ref="controlWrapper">
      <slot :id="fieldId" />
    </div>

    <p v-if="error" :id="`${fieldId}-error`" class="mt-1 text-sm text-red-600">
      <slot name="error">{{ error }}</slot>
    </p>
    <p v-else-if="hint" class="mt-1 text-sm text-gray-500">{{ hint }}</p>
  </div>
</template>
