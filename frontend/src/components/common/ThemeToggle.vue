<template>
  <button
    type="button"
    class="p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors"
    :title="`Tema: ${label}. Clique para mudar.`"
    :aria-label="`Tema: ${label}. Clique para mudar.`"
    @click="cycle"
  >
    <svg
      v-if="themeStore.mode === 'light'"
      xmlns="http://www.w3.org/2000/svg"
      class="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
    >
      <circle cx="12" cy="12" r="4" />
      <path
        d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
      />
    </svg>
    <svg
      v-else-if="themeStore.mode === 'dark'"
      xmlns="http://www.w3.org/2000/svg"
      class="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
    >
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
    <svg
      v-else
      xmlns="http://www.w3.org/2000/svg"
      class="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
    >
      <rect x="2" y="4" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useThemeStore, type ThemeMode } from '@/stores/theme.store'

const themeStore = useThemeStore()

const ORDER: ThemeMode[] = ['system', 'light', 'dark']

const LABELS: Record<ThemeMode, string> = {
  system: 'Sistema',
  light: 'Claro',
  dark: 'Escuro',
}

const label = computed(() => LABELS[themeStore.mode])

function cycle(): void {
  const currentIndex = ORDER.indexOf(themeStore.mode)
  const next = ORDER[(currentIndex + 1) % ORDER.length]
  themeStore.setMode(next)
}
</script>
