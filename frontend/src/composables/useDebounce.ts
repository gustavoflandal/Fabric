import { customRef, onUnmounted } from 'vue'

/**
 * Cria uma versao "debounced" de uma funcao: so executa `delayMs`
 * milissegundos apos a ultima chamada (os argumentos da ultima chamada
 * vencem). Pensada para minimizar a mudanca no template - normalmente
 * basta trocar o handler usado no `@input`:
 *
 *   // antes: dispara a busca a cada tecla
 *   <input v-model="filters.search" @input="handleFilterChange" />
 *
 *   // depois: so busca 350ms apos o usuario parar de digitar
 *   const debouncedFilterChange = useDebounce(handleFilterChange, 350)
 *   <input v-model="filters.search" @input="debouncedFilterChange" />
 *
 * O timer pendente e cancelado automaticamente quando o componente que
 * criou a funcao e desmontado.
 */
export function useDebounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  delayMs = 350
): (...args: Args) => void {
  let timer: ReturnType<typeof setTimeout> | undefined

  const debounced = (...args: Args): void => {
    if (timer !== undefined) {
      clearTimeout(timer)
    }
    timer = setTimeout(() => {
      timer = undefined
      fn(...args)
    }, delayMs)
  }

  onUnmounted(() => {
    if (timer !== undefined) {
      clearTimeout(timer)
    }
  })

  return debounced
}

/**
 * Variante em forma de `ref`: o valor exposto (ex.: usado em `v-model`)
 * atualiza a UI imediatamente, mas so notifica os observadores (watchers)
 * `delayMs` depois da ultima mudanca. Util quando a busca e disparada por
 * um `watch()` sobre o valor em vez de um handler de evento.
 */
export function useDebouncedRef<T>(initialValue: T, delayMs = 350) {
  let value = initialValue
  let timer: ReturnType<typeof setTimeout> | undefined

  return customRef<T>((track, trigger) => ({
    get() {
      track()
      return value
    },
    set(newValue: T) {
      value = newValue
      if (timer !== undefined) {
        clearTimeout(timer)
      }
      timer = setTimeout(() => {
        timer = undefined
        trigger()
      }, delayMs)
    },
  }))
}
