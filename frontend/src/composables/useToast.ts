import { reactive } from 'vue'

/**
 * Sistema de toast (mensagens transitorias de sucesso/erro/aviso/info).
 *
 * Estado global compartilhado por todos os componentes que chamam
 * `useToast()` - basta montar um unico `<ToastContainer />` (ja incluido
 * em App.vue) para renderizar os toasts empurrados de qualquer lugar da
 * aplicacao.
 *
 * Uso tipico (substituindo `alert(...)`):
 *
 *   const toast = useToast()
 *   toast.success('Registro criado com sucesso!')
 *   toast.error(error.response?.data?.message || 'Erro ao salvar')
 */

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: number
  type: ToastType
  message: string
  duration: number
}

const DEFAULT_DURATION: Record<ToastType, number> = {
  success: 4000,
  info: 4000,
  warning: 5000,
  error: 6000,
}

let nextId = 1
const toasts = reactive<Toast[]>([])

function dismiss(id: number): void {
  const index = toasts.findIndex((t) => t.id === id)
  if (index !== -1) {
    toasts.splice(index, 1)
  }
}

function push(message: string, type: ToastType = 'info', duration?: number): number {
  const id = nextId++
  const resolvedDuration = duration ?? DEFAULT_DURATION[type]
  toasts.push({ id, type, message, duration: resolvedDuration })

  if (resolvedDuration > 0) {
    setTimeout(() => dismiss(id), resolvedDuration)
  }

  return id
}

export function useToast() {
  return {
    toasts,
    push,
    dismiss,
    success: (message: string, duration?: number) => push(message, 'success', duration),
    error: (message: string, duration?: number) => push(message, 'error', duration),
    warning: (message: string, duration?: number) => push(message, 'warning', duration),
    info: (message: string, duration?: number) => push(message, 'info', duration),
  }
}
