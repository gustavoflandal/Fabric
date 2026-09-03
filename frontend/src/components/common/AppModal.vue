<template>
  <Teleport to="body">
    <!-- Overlay canonico (§4.2, dominante ~16x). Esc e clique no overlay fecham. -->
    <div
      v-if="modelValue"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      @click.self="close"
      @keydown.esc="close"
    >
      <div
        ref="dialogRef"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
        :class="boxClasses"
        tabindex="-1"
        @click.stop
        @keydown.tab="handleTab"
      >
        <div class="flex justify-between items-center px-6 py-4 border-b border-gray-200">
          <h3 class="text-2xl font-bold text-gray-900">{{ title }}</h3>
          <button
            ref="closeBtnRef"
            type="button"
            aria-label="Fechar"
            class="text-2xl text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded"
            @click="close"
          >
            &#10005;
          </button>
        </div>

        <div class="px-6 py-4">
          <slot />
        </div>

        <div v-if="$slots.footer" class="px-6 py-4 border-t border-gray-200">
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl'

interface Props {
  /** Contrato v-model — familia B da §2.5, escolhida como oficial (I5). */
  modelValue: boolean
  title?: string
  size?: ModalSize
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  size: 'md',
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  close: []
}>()

// md = max-w-2xl (caixa dominante, §4.2); lg = max-w-4xl (variante maior ja usada
// em WarehouseStructuresView.vue:259 e PurchaseOrdersView.vue:122).
const SIZES: Record<ModalSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-6xl',
}

const boxClasses = computed(
  () => `bg-white rounded-lg w-full ${SIZES[props.size]} max-h-[90vh] overflow-y-auto`
)

const dialogRef = ref<HTMLElement | null>(null)
const closeBtnRef = ref<HTMLButtonElement | null>(null)
let previouslyFocused: HTMLElement | null = null

function close(): void {
  emit('update:modelValue', false)
  emit('close')
}

// Logica de foco portada de ConfirmDialogContainer.vue:55-89 (§4.1/§4.2):
// guarda o elemento focado, foca ao abrir, devolve o foco ao fechar.
watch(
  () => props.modelValue,
  async (visible) => {
    if (visible) {
      previouslyFocused = document.activeElement as HTMLElement | null
      await nextTick()
      const firstField = dialogRef.value?.querySelector<HTMLElement>(
        'input, select, textarea'
      )
      ;(firstField ?? closeBtnRef.value ?? dialogRef.value)?.focus()
    } else if (previouslyFocused) {
      previouslyFocused.focus()
      previouslyFocused = null
    }
  }
)

// Focus trap basico: mantem o Tab/Shift+Tab circulando entre os elementos
// focaveis do modal enquanto ele estiver aberto.
function handleTab(event: KeyboardEvent): void {
  const focusable = dialogRef.value?.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  )
  if (!focusable || focusable.length === 0) return

  const first = focusable[0]
  const last = focusable[focusable.length - 1]

  if (event.shiftKey) {
    if (document.activeElement === first) {
      event.preventDefault()
      last.focus()
    }
  } else if (document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}
</script>
