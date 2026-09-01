import { reactive } from 'vue'

/**
 * Sistema de confirmacao baseado em Promise, para substituir o `confirm()`
 * nativo do navegador com a menor mudanca possivel no call site:
 *
 *   // antes
 *   if (confirm('Deseja realmente excluir?')) { ... }
 *
 *   // depois
 *   if (await confirmDialog('Deseja realmente excluir?')) { ... }
 *
 * O modal correspondente (`<ConfirmDialogContainer />`) e montado uma unica
 * vez em App.vue e observa este estado compartilhado.
 */

export interface ConfirmOptions {
  title?: string
  confirmText?: string
  cancelText?: string
}

interface ConfirmState {
  visible: boolean
  message: string
  title: string
  confirmText: string
  cancelText: string
}

const state = reactive<ConfirmState>({
  visible: false,
  message: '',
  title: 'Confirmação',
  confirmText: 'Confirmar',
  cancelText: 'Cancelar',
})

let resolvePromise: ((value: boolean) => void) | null = null

export function confirmDialog(message: string, options: ConfirmOptions = {}): Promise<boolean> {
  // Se ja houver uma confirmacao pendente, resolve como cancelada antes de
  // abrir a nova - evita Promises orfas.
  if (resolvePromise) {
    resolvePromise(false)
    resolvePromise = null
  }

  state.message = message
  state.title = options.title ?? 'Confirmação'
  state.confirmText = options.confirmText ?? 'Confirmar'
  state.cancelText = options.cancelText ?? 'Cancelar'
  state.visible = true

  return new Promise<boolean>((resolve) => {
    resolvePromise = resolve
  })
}

function settle(value: boolean): void {
  state.visible = false
  const resolve = resolvePromise
  resolvePromise = null
  resolve?.(value)
}

export function useConfirmDialog() {
  return {
    state,
    confirm: () => settle(true),
    cancel: () => settle(false),
  }
}
