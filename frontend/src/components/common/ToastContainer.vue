<template>
  <Teleport to="body">
    <div class="fixed top-4 right-4 z-[70] flex w-full max-w-sm flex-col gap-2 pointer-events-none">
      <TransitionGroup name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          role="status"
          class="pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg"
          :class="toastClasses(toast.type)"
        >
          <span class="mt-0.5 text-base leading-none font-bold">{{ toastIcon(toast.type) }}</span>
          <p class="flex-1 text-sm font-medium whitespace-pre-line">{{ toast.message }}</p>
          <button
            type="button"
            class="text-base leading-none opacity-60 hover:opacity-100 focus:outline-none"
            aria-label="Fechar notificacao"
            @click="dismiss(toast.id)"
          >
            &times;
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useToast, type ToastType } from '@/composables/useToast'

const { toasts, dismiss } = useToast()

const toastClasses = (type: ToastType): string => {
  const map: Record<ToastType, string> = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-primary-50 border-primary-200 text-primary-800',
  }
  return map[type]
}

const toastIcon = (type: ToastType): string => {
  const map: Record<ToastType, string> = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  }
  return map[type]
}
</script>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.2s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(1rem);
}
</style>
