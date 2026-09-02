<template>
  <Teleport to="body">
    <div
      v-if="state.visible"
      class="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50 px-4"
      @keydown.esc="cancel"
      @click.self="cancel"
    >
      <div
        ref="dialogRef"
        role="alertdialog"
        aria-modal="true"
        :aria-label="state.title"
        class="w-full max-w-md rounded-lg bg-white shadow-xl"
        @keydown.tab="handleTab"
      >
        <div class="p-6">
          <h3 class="text-lg font-semibold text-gray-900">{{ state.title }}</h3>
          <p class="mt-2 text-sm text-gray-600 whitespace-pre-line">{{ state.message }}</p>
        </div>
        <div class="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button
            ref="cancelBtnRef"
            type="button"
            class="rounded-lg border-2 border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
            @click="cancel"
          >
            {{ state.cancelText }}
          </button>
          <button
            ref="confirmBtnRef"
            type="button"
            class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            @click="confirm"
          >
            {{ state.confirmText }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useConfirmDialog } from '@/composables/useConfirm'

const { state, confirm, cancel } = useConfirmDialog()

const dialogRef = ref<HTMLElement | null>(null)
const confirmBtnRef = ref<HTMLButtonElement | null>(null)
const cancelBtnRef = ref<HTMLButtonElement | null>(null)
let previouslyFocused: HTMLElement | null = null

watch(
  () => state.visible,
  async (visible) => {
    if (visible) {
      previouslyFocused = document.activeElement as HTMLElement | null
      await nextTick()
      cancelBtnRef.value?.focus()
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
