import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

export type ThemeMode = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'themeMode'
const VALID_MODES: ThemeMode[] = ['system', 'light', 'dark']

function readStoredMode(): ThemeMode {
  const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null
  return stored && VALID_MODES.includes(stored) ? stored : 'system'
}

function readSystemPrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export const useThemeStore = defineStore('theme', () => {
  const mode = ref<ThemeMode>(readStoredMode())
  const systemPrefersDark = ref(readSystemPrefersDark())

  const isDark = computed(() => {
    if (mode.value === 'dark') return true
    if (mode.value === 'light') return false
    return systemPrefersDark.value
  })

  function setMode(next: ThemeMode): void {
    mode.value = next
    localStorage.setItem(STORAGE_KEY, next)
  }

  function applyDomClass(dark: boolean): void {
    document.documentElement.classList.toggle('dark', dark)
  }

  // Chamada uma vez em App.vue (onMounted), mesmo padrão de authStore.initialize().
  // Registra o listener de mudança do SO e o watch que mantém a classe `dark`
  // em <html> sincronizada com isDark daqui pra frente.
  function initialize(): void {
    watch(isDark, applyDomClass, { immediate: true, flush: 'sync' })

    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', (event: MediaQueryListEvent) => {
      systemPrefersDark.value = event.matches
    })
  }

  return { mode, isDark, setMode, initialize }
})
