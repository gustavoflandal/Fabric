# Dark Mode — Fase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a working dark mode toggle (system-preference-aware, with manual override, persisted per browser) to the Fabric frontend, and retrofit the shared app shell plus two key screens (`DashboardView.vue`, `WmsKpiDashboardView.vue`) to actually render correctly in dark mode.

**Architecture:** Tailwind `darkMode: 'class'` strategy. A new Pinia store (`theme.store.ts`) owns a `mode: 'system'|'light'|'dark'` ref (persisted to `localStorage`), exposes a computed `isDark`, and toggles a `dark` class on `document.documentElement`. A new `ThemeToggle.vue` button (mounted in the shared `AppLayout.vue` header) cycles the three modes. Existing components get `dark:` utility-class siblings added next to their existing light-mode classes — no new CSS files, no semantic color tokens in this phase.

**Tech Stack:** Vue 3 `<script setup>` (Composition API), Pinia (setup-store style, matching `auth.store.ts`), Tailwind CSS utility classes, Vitest + `@vue/test-utils`, Chart.js (`chart.js/auto`).

## Global Constraints

- Composition API `<script setup lang="ts">` only — match the style already used by every file this plan touches.
- Pinia stores use the setup-store function style (`defineStore('id', () => { ... return {...} })`), matching `frontend/src/stores/auth.store.ts` — not the options-store style.
- No new CSS files and no CSS custom properties/semantic tokens in this phase (spec explicitly chose the Tailwind `dark:` utility-variant approach over a token-based rewrite).
- Test environment is `jsdom` (see `frontend/vite.config.ts`), which does **not** implement `window.matchMedia` — every test that touches `theme.store.ts` (directly or via a mounted component that uses it) must stub it with `vi.stubGlobal('matchMedia', ...)` or mock the whole store module; do not assume a real `matchMedia` exists in tests.
- Preserve the existing light-mode look pixel-for-pixel when no `dark` class is present — every change in this plan is additive (`dark:` variants alongside existing classes), never a replacement of an existing light-mode class.
- Reuse the existing Tailwind color scale already defined in `tailwind.config.js` (the `gray`/`primary`/`red` scales) — no new colors are introduced by this plan.

---

### Task 1: `theme.store.ts` — Pinia store for theme state

**Files:**
- Create: `frontend/src/stores/theme.store.ts`
- Test: `frontend/src/stores/__tests__/theme.store.spec.ts`

**Interfaces:**
- Produces: `useThemeStore()` returning `{ mode: Ref<'system'|'light'|'dark'>, isDark: ComputedRef<boolean>, setMode(next: 'system'|'light'|'dark'): void, initialize(): void }`. Also exports the type `ThemeMode = 'system' | 'light' | 'dark'` for `ThemeToggle.vue` (Task 3) to import.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/stores/__tests__/theme.store.spec.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useThemeStore } from '../theme.store'

function mockMatchMedia(initialMatches: boolean) {
  const listeners: Array<(e: MediaQueryListEvent) => void> = []
  const mql = {
    matches: initialMatches,
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_type: string, cb: (e: MediaQueryListEvent) => void) => listeners.push(cb),
    removeEventListener: vi.fn(),
  }
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(mql))
  return {
    fireChange(matches: boolean) {
      mql.matches = matches
      listeners.forEach((cb) => cb({ matches } as MediaQueryListEvent))
    },
  }
}

describe('useThemeStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    document.documentElement.classList.remove('dark')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('usa mode "system" por padrão quando não há preferência salva', () => {
    mockMatchMedia(false)
    const store = useThemeStore()
    expect(store.mode).toBe('system')
  })

  it('carrega o modo salvo no localStorage na criação da store', () => {
    localStorage.setItem('themeMode', 'dark')
    mockMatchMedia(false)
    const store = useThemeStore()
    expect(store.mode).toBe('dark')
  })

  it('ignora um valor inválido salvo no localStorage e usa "system"', () => {
    localStorage.setItem('themeMode', 'roxo')
    mockMatchMedia(false)
    const store = useThemeStore()
    expect(store.mode).toBe('system')
  })

  it('isDark resolve via matchMedia quando mode é "system"', () => {
    mockMatchMedia(true)
    const store = useThemeStore()
    expect(store.isDark).toBe(true)
  })

  it('setMode("light") força isDark=false mesmo com o sistema em dark, e persiste', () => {
    mockMatchMedia(true)
    const store = useThemeStore()
    store.setMode('light')
    expect(store.isDark).toBe(false)
    expect(localStorage.getItem('themeMode')).toBe('light')
  })

  it('initialize() aplica a classe dark no documentElement conforme isDark', () => {
    mockMatchMedia(true)
    const store = useThemeStore()
    store.initialize()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('initialize() remove a classe dark quando isDark é false', () => {
    mockMatchMedia(false)
    document.documentElement.classList.add('dark')
    const store = useThemeStore()
    store.initialize()
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('reage em tempo real a uma mudança do sistema quando mode é "system"', () => {
    const { fireChange } = mockMatchMedia(false)
    const store = useThemeStore()
    store.initialize()
    expect(document.documentElement.classList.contains('dark')).toBe(false)

    fireChange(true)
    expect(store.isDark).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('ignora uma mudança do sistema quando o modo é manual (dark)', () => {
    const { fireChange } = mockMatchMedia(true)
    const store = useThemeStore()
    store.setMode('dark')
    store.initialize()

    fireChange(false) // sistema muda para claro, mas o modo continua manual em 'dark'
    expect(store.isDark).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/stores/__tests__/theme.store.spec.ts`
Expected: FAIL — `Cannot find module '../theme.store'` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `frontend/src/stores/theme.store.ts`:

```typescript
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
    watch(isDark, applyDomClass, { immediate: true })

    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', (event: MediaQueryListEvent) => {
      systemPrefersDark.value = event.matches
    })
  }

  return { mode, isDark, setMode, initialize }
})
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/stores/__tests__/theme.store.spec.ts`
Expected: PASS — 9 tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/stores/theme.store.ts frontend/src/stores/__tests__/theme.store.spec.ts
git commit -m "feat(dark-mode): adiciona theme.store com persistencia e deteccao de preferencia do sistema"
```

---

### Task 2: Tailwind `darkMode: 'class'` + base body colors

**Files:**
- Modify: `frontend/tailwind.config.js`
- Modify: `frontend/src/style.css`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: the `dark:` variant becomes usable across the whole app (gated on the `dark` class Task 1's store toggles on `<html>`); `<body>` itself now flips between light/dark automatically, which is what makes plain `<td>` cells and any other un-classed text in later tasks inherit the correct color without individual `dark:` classes.

- [ ] **Step 1: Enable the class strategy**

In `frontend/tailwind.config.js`, add `darkMode: 'class',` as the first key of the config object:

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
```

- [ ] **Step 2: Pair the base body colors**

In `frontend/src/style.css`, change:

```css
@layer base {
  body {
    @apply bg-gray-50 text-gray-900;
  }
}
```

to:

```css
@layer base {
  body {
    @apply bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100;
  }
}
```

- [ ] **Step 3: Verify the frontend still builds and existing tests are unaffected**

Run: `cd frontend && npm test`
Expected: same pass count as before this task (this change adds no new behavior yet — no component reads `isDark` or applies the `dark` class until Task 1's store is wired up in Task 4).

- [ ] **Step 4: Commit**

```bash
git add frontend/tailwind.config.js frontend/src/style.css
git commit -m "feat(dark-mode): habilita a estrategia darkMode:class do Tailwind e o par escuro do body"
```

---

### Task 3: `ThemeToggle.vue` component

**Files:**
- Create: `frontend/src/components/common/ThemeToggle.vue`
- Test: `frontend/src/components/common/__tests__/ThemeToggle.spec.ts`

**Interfaces:**
- Consumes: `useThemeStore()` from Task 1 (`mode`, `setMode`).
- Produces: `ThemeToggle.vue` — a self-contained button with no props/emits, for Task 4 to drop into `AppLayout.vue`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/components/common/__tests__/ThemeToggle.spec.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import ThemeToggle from '../ThemeToggle.vue'
import { useThemeStore } from '@/stores/theme.store'

describe('ThemeToggle', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })
    )
  })

  it('inicia no modo "system" e cicla para "light" ao clicar', async () => {
    const wrapper = mount(ThemeToggle)
    const store = useThemeStore()
    expect(store.mode).toBe('system')

    await wrapper.find('button').trigger('click')
    expect(store.mode).toBe('light')
  })

  it('cicla light -> dark -> system corretamente', async () => {
    const wrapper = mount(ThemeToggle)
    const store = useThemeStore()
    store.setMode('light')

    await wrapper.find('button').trigger('click')
    expect(store.mode).toBe('dark')

    await wrapper.find('button').trigger('click')
    expect(store.mode).toBe('system')
  })

  it('aria-label reflete o modo atual', async () => {
    const wrapper = mount(ThemeToggle)
    const store = useThemeStore()
    store.setMode('dark')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('button').attributes('aria-label')).toContain('Escuro')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/common/__tests__/ThemeToggle.spec.ts`
Expected: FAIL — `Cannot find module '../ThemeToggle.vue'`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/components/common/ThemeToggle.vue`:

```vue
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/common/__tests__/ThemeToggle.spec.ts`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/common/ThemeToggle.vue frontend/src/components/common/__tests__/ThemeToggle.spec.ts
git commit -m "feat(dark-mode): adiciona o botao ThemeToggle (cicla claro/escuro/sistema)"
```

---

### Task 4: Wire the store into the app + retrofit `AppLayout.vue`

**Files:**
- Modify: `frontend/src/App.vue`
- Modify: `frontend/src/components/common/AppLayout.vue`
- Modify: `frontend/src/components/common/__tests__/AppLayout.spec.ts`
- Modify: `frontend/src/views/settings/__tests__/SystemSettingsView.spec.ts`
- Modify: `frontend/src/views/wms/__tests__/OperationsPanelView.spec.ts`
- Modify: `frontend/src/views/wms/__tests__/WmsKpiDashboardView.spec.ts`
- Modify: `frontend/src/views/wms/__tests__/WorkflowTemplateEditorView.spec.ts`

**Interfaces:**
- Consumes: `useThemeStore()` (Task 1), `ThemeToggle.vue` (Task 3).
- Produces: every view that renders through `AppLayout.vue` (26 views app-wide) immediately gets a working header/background in dark mode, plus a working toggle, even before their own content is retrofitted.

**Why the 5 test files change:** `AppLayout.vue` will now render `<ThemeToggle />`, which calls the real `useThemeStore()`. These 5 spec files fully mount a component that renders `AppLayout` but never call `setActivePinia()` (they mock `@/stores/auth.store` instead of using real Pinia) — without a mock for `@/stores/theme.store` too, `useThemeStore()` throws `getActivePinia() was called but there was no active Pinia`. This is the same style of fix already used for `auth.store` in these files.

- [ ] **Step 1: Wire `themeStore.initialize()` into `App.vue`**

In `frontend/src/App.vue`, change:

```typescript
import { RouterView } from 'vue-router'
import { onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import ToastContainer from '@/components/common/ToastContainer.vue'
import ConfirmDialogContainer from '@/components/common/ConfirmDialogContainer.vue'
import ChatAssistant from '@/components/assistant/ChatAssistant.vue'

const authStore = useAuthStore()
const isInitializing = ref(true)

onMounted(async () => {
  try {
    if (import.meta.env.DEV) {
      console.log('🚀 Inicializando aplicação...')
    }
    
    // Initialize auth store on app mount
    await authStore.initialize()
```

to:

```typescript
import { RouterView } from 'vue-router'
import { onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { useThemeStore } from '@/stores/theme.store'
import ToastContainer from '@/components/common/ToastContainer.vue'
import ConfirmDialogContainer from '@/components/common/ConfirmDialogContainer.vue'
import ChatAssistant from '@/components/assistant/ChatAssistant.vue'

const authStore = useAuthStore()
const themeStore = useThemeStore()
const isInitializing = ref(true)

onMounted(async () => {
  themeStore.initialize()

  try {
    if (import.meta.env.DEV) {
      console.log('🚀 Inicializando aplicação...')
    }
    
    // Initialize auth store on app mount
    await authStore.initialize()
```

(No test file exists for `App.vue` today — nothing to update here.)

- [ ] **Step 2: Retrofit `AppLayout.vue`'s own template + mount the toggle**

In `frontend/src/components/common/AppLayout.vue`, change:

```vue
<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header canonico — substitui as 26 copias do bloco de SuppliersView.vue:3-24 (I1). -->
    <header class="bg-white shadow-sm border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
          <div class="flex items-center">
            <img src="/logo.png" alt="Fabric" class="h-10 w-auto" />
            <h1 class="ml-4 text-2xl font-bold text-primary-800">Fabric</h1>
          </div>

          <div class="flex items-center space-x-4">
            <slot name="nav">
              <RouterLink to="/dashboard" class="text-sm text-gray-700 hover:text-primary-600">
                Início
              </RouterLink>
            </slot>
            <span class="text-sm text-gray-700">
              Olá, <span class="font-semibold">{{ authStore.userName }}</span>
            </span>
            <Button variant="outline" size="sm" @click="handleLogout">
              Sair
            </Button>
          </div>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div v-if="title || $slots.actions" class="mb-6 flex justify-between items-center">
        <div>
          <h2 v-if="title" class="text-3xl font-bold text-gray-900">{{ title }}</h2>
          <p v-if="subtitle" class="mt-1 text-sm text-gray-600">{{ subtitle }}</p>
        </div>
        <slot name="actions" />
      </div>

      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import Button from '@/components/common/Button.vue'
```

to:

```vue
<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Header canonico — substitui as 26 copias do bloco de SuppliersView.vue:3-24 (I1). -->
    <header class="bg-white shadow-sm border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
          <div class="flex items-center">
            <img src="/logo.png" alt="Fabric" class="h-10 w-auto" />
            <h1 class="ml-4 text-2xl font-bold text-primary-800 dark:text-primary-300">Fabric</h1>
          </div>

          <div class="flex items-center space-x-4">
            <slot name="nav">
              <RouterLink to="/dashboard" class="text-sm text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400">
                Início
              </RouterLink>
            </slot>
            <span class="text-sm text-gray-700 dark:text-gray-300">
              Olá, <span class="font-semibold">{{ authStore.userName }}</span>
            </span>
            <ThemeToggle />
            <Button variant="outline" size="sm" @click="handleLogout">
              Sair
            </Button>
          </div>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div v-if="title || $slots.actions" class="mb-6 flex justify-between items-center">
        <div>
          <h2 v-if="title" class="text-3xl font-bold text-gray-900 dark:text-gray-100">{{ title }}</h2>
          <p v-if="subtitle" class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ subtitle }}</p>
        </div>
        <slot name="actions" />
      </div>

      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import Button from '@/components/common/Button.vue'
import ThemeToggle from '@/components/common/ThemeToggle.vue'
```

- [ ] **Step 3: Run the AppLayout test to confirm it now fails on the missing theme store mock**

Run: `cd frontend && npx vitest run src/components/common/__tests__/AppLayout.spec.ts`
Expected: FAIL — `getActivePinia() was called but there was no active Pinia` (or similar), because `ThemeToggle` now calls the real `useThemeStore()`.

- [ ] **Step 4: Mock `@/stores/theme.store` in the 5 affected spec files**

In `frontend/src/components/common/__tests__/AppLayout.spec.ts`, right after the existing block:

```typescript
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ userName: 'Gustavo', logout }),
}))
```

add:

```typescript
vi.mock('@/stores/theme.store', () => ({
  useThemeStore: () => ({ mode: 'system', isDark: false, setMode: vi.fn() }),
}))
```

Apply the same fix to the other 4 files. Each one gets the identical block added:

```typescript
vi.mock('@/stores/theme.store', () => ({
  useThemeStore: () => ({ mode: 'system', isDark: false, setMode: vi.fn() }),
}))
```

In `frontend/src/views/settings/__tests__/SystemSettingsView.spec.ts`, insert it directly after:

```typescript
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ userName: 'Teste', logout: vi.fn() }),
}))
```

In `frontend/src/views/wms/__tests__/OperationsPanelView.spec.ts`, insert it directly after the closing `}))` of the existing `vi.mock('@/stores/auth.store', () => ({ useAuthStore: () => ({ user: { id: 'me', ... }, userName: 'Operador', ... }) }))` block.

In `frontend/src/views/wms/__tests__/WmsKpiDashboardView.spec.ts`, insert it directly after:

```typescript
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ userName: 'Teste', logout: vi.fn() }),
}))
```

In `frontend/src/views/wms/__tests__/WorkflowTemplateEditorView.spec.ts`, insert it directly after:

```typescript
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ userName: 'Gustavo', logout: vi.fn() }),
}))
```

- [ ] **Step 5: Run the full frontend suite to confirm no regressions**

Run: `cd frontend && npm test`
Expected: PASS — same file count as before Task 1, plus the 2 new files from Tasks 1 and 3 (no test count regression in any existing file).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/App.vue frontend/src/components/common/AppLayout.vue \
  frontend/src/components/common/__tests__/AppLayout.spec.ts \
  frontend/src/views/settings/__tests__/SystemSettingsView.spec.ts \
  frontend/src/views/wms/__tests__/OperationsPanelView.spec.ts \
  frontend/src/views/wms/__tests__/WmsKpiDashboardView.spec.ts \
  frontend/src/views/wms/__tests__/WorkflowTemplateEditorView.spec.ts
git commit -m "feat(dark-mode): monta o ThemeToggle no AppLayout e inicializa o tema em App.vue"
```

---

### Task 5: Retrofit `Card.vue` (shared dependency of Tasks 6 and 7)

**Files:**
- Modify: `frontend/src/components/common/Card.vue`

**Interfaces:**
- Consumes: nothing new — this is a pure CSS-class change.
- Produces: every `<Card>` usage (including in `DashboardView.vue` and `WmsKpiDashboardView.vue`, Tasks 6/7) renders correctly in dark mode without those views needing to touch `Card.vue`'s internals themselves.

**Why this file, even though the spec named only 3 files:** `Card.vue` is a shared component both target views depend on for their card/panel chrome (`bg-white`, `border-gray-200`, etc.) — retrofitting the two target views without it would leave every `<Card>` block inside them a white box on a dark page.

- [ ] **Step 1: Retrofit the template and computed classes**

In `frontend/src/components/common/Card.vue`, change:

```vue
<template>
  <div :class="cardClasses">
    <div v-if="$slots.header || title" class="px-6 py-4 border-b border-gray-200">
      <slot name="header">
        <h3 class="text-lg font-semibold text-gray-900">{{ title }}</h3>
      </slot>
    </div>
    
    <div :class="bodyClasses">
      <slot />
    </div>
    
    <div v-if="$slots.footer" class="px-6 py-4 border-t border-gray-200 bg-gray-50">
      <slot name="footer" />
    </div>
  </div>
</template>
```

to:

```vue
<template>
  <div :class="cardClasses">
    <div v-if="$slots.header || title" class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
      <slot name="header">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ title }}</h3>
      </slot>
    </div>
    
    <div :class="bodyClasses">
      <slot />
    </div>
    
    <div v-if="$slots.footer" class="px-6 py-4 border-t border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
      <slot name="footer" />
    </div>
  </div>
</template>
```

And change:

```typescript
const cardClasses = computed(() => {
  const base = 'bg-white rounded-lg border border-gray-200'
```

to:

```typescript
const cardClasses = computed(() => {
  const base = 'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700'
```

- [ ] **Step 2: Run the full frontend suite to confirm no regressions**

Run: `cd frontend && npm test`
Expected: PASS — no test asserts on `Card.vue`'s exact class list today (checked: no existing spec does an exact-match `.classes()` assertion against `Card`'s root), so adding `dark:` siblings should not break anything.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/common/Card.vue
git commit -m "feat(dark-mode): adiciona variantes dark: ao componente Card compartilhado"
```

---

### Task 6: Retrofit `DashboardView.vue`

**Files:**
- Modify: `frontend/src/views/DashboardView.vue`

**Interfaces:**
- Consumes: the `dark` class mechanism from Tasks 1/2/4; `Card.vue` from Task 5.
- Produces: nothing consumed by later tasks — this is a leaf view.

No spec file exists for `DashboardView.vue` today, so this task has no test-writing step; verification is the full suite run (no regressions) plus the manual visual check in Task 8.

- [ ] **Step 1: Pair the welcome text and tab-nav border**

Change:

```vue
      <p class="text-xl text-gray-600">
        Bem-vindo ao sistema de Planejamento e Controle da Produção
      </p>
```

to:

```vue
      <p class="text-xl text-gray-600 dark:text-gray-400">
        Bem-vindo ao sistema de Planejamento e Controle da Produção
      </p>
```

Change:

```vue
          <div class="mb-6 border-b border-gray-200">
```

to:

```vue
          <div class="mb-6 border-b border-gray-200 dark:border-gray-700">
```

- [ ] **Step 2: Pair the 4 tab-button states**

The inactive-tab class string is repeated identically across all 4 tab buttons (Geral/PCP/WMS/YMS). Using the Edit tool with `replace_all: true`, change every occurrence of:

```
border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300
```

to:

```
border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600
```

The active-tab class string is also repeated identically across all 4 tab buttons. Using `replace_all: true`, change every occurrence of:

```
'border-primary-500 text-primary-600'
```

to:

```
'border-primary-500 text-primary-600 dark:text-primary-300'
```

- [ ] **Step 3: Pair the module-card grid (24 clickable cards + 9 "Em breve" cards)**

The clickable-card wrapper class is repeated identically 24 times (every `RouterLink` card across the Geral/PCP/WMS tabs). Using `replace_all: true`, change every occurrence of:

```
p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer
```

to:

```
p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer dark:border-gray-700 dark:hover:border-primary-500 dark:hover:bg-gray-800
```

The disabled "Em breve" card wrapper class is repeated identically 9 times. Using `replace_all: true`, change every occurrence of:

```
class="p-4 border-2 border-gray-200 rounded-lg bg-gray-50 opacity-50 cursor-not-allowed"
```

to:

```
class="p-4 border-2 border-gray-200 rounded-lg bg-gray-50 opacity-50 cursor-not-allowed dark:border-gray-700 dark:bg-gray-900"
```

The active card label (`text-sm font-medium text-gray-700`) is repeated identically 25 times. Using `replace_all: true`, change every occurrence of:

```
class="text-sm font-medium text-gray-700"
```

to:

```
class="text-sm font-medium text-gray-700 dark:text-gray-300"
```

The disabled card label class (`text-sm font-medium text-gray-500`) appears 8 times — leave these **unchanged**: `text-gray-500` is already legible against both the light and dark disabled-card backgrounds (it's a mid-tone gray, not a near-black one), so no `dark:` pairing is needed here. Likewise leave `text-xs text-gray-400 mt-1` (the "Em breve" caption, 9 occurrences) unchanged for the same reason.

- [ ] **Step 4: Run the full frontend suite to confirm no regressions**

Run: `cd frontend && npm test`
Expected: PASS — no spec file exists for `DashboardView.vue`, so nothing to break here directly; confirm the overall suite count is unchanged from Task 5's baseline.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/DashboardView.vue
git commit -m "feat(dark-mode): retrofita DashboardView.vue com variantes dark:"
```

---

### Task 7: Retrofit `WmsKpiDashboardView.vue` (template + Chart.js theming)

**Files:**
- Modify: `frontend/src/views/wms/WmsKpiDashboardView.vue`

**Interfaces:**
- Consumes: `useThemeStore()` (Task 1); the `dark` class mechanism; `Card.vue` (Task 5).
- Produces: the reference retrofit pattern for future batches on screens with tabs/cards/tables/Chart.js graphs (documented in the spec's conversion recipe table).

- [ ] **Step 1: Pair the loading/error/tab-nav chrome**

Change:

```vue
    <div v-if="loading" class="text-center py-12">
      <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      <p class="mt-4 text-gray-600">Carregando dashboard...</p>
    </div>
```

to:

```vue
    <div v-if="loading" class="text-center py-12">
      <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      <p class="mt-4 text-gray-600 dark:text-gray-400">Carregando dashboard...</p>
    </div>
```

The full-page and per-tab error boxes share the identical wrapper class, repeated 6 times. Using `replace_all: true`, change every occurrence of:

```
class="bg-red-50 border border-red-200 rounded-lg p-6 text-center"
```

to:

```
class="bg-red-50 border border-red-200 rounded-lg p-6 text-center dark:bg-red-950 dark:border-red-900"
```

The error message text `<p>` shares the identical class, repeated 6 times (the top-level `error` message plus the 5 per-tab `taskKpisError`/`occupancyError` messages). Using `replace_all: true`, change every occurrence of:

```
class="text-red-600"
```

to:

```
class="text-red-600 dark:text-red-400"
```

Change the tab-button ternary:

```vue
            :class="activeTab === tab.key ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700'"
```

to:

```vue
            :class="activeTab === tab.key ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'"
```

Change the period `<select>`:

```vue
          <select v-if="activeTab !== 'ocupacao'" v-model.number="days" class="rounded-md border-gray-300 text-sm">
```

to:

```vue
          <select v-if="activeTab !== 'ocupacao'" v-model.number="days" class="rounded-md border-gray-300 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
```

- [ ] **Step 2: Pair the KPI stat cards and tables**

The white stat-card wrapper is repeated identically 5 times (2 in "volume", 1 in "ciclo", 1 in "gargalos" — inside the `v-for`, 1 in "ocupacao"). Using `replace_all: true`, change every occurrence of:

```
bg-white rounded-lg shadow-sm border border-gray-200 p-4
```

to:

```
bg-white rounded-lg shadow-sm border border-gray-200 p-4 dark:bg-gray-800 dark:border-gray-700
```

The stat-card label text is repeated identically 5 times. Using `replace_all: true`, change every occurrence of:

```
class="text-sm text-gray-600"
```

to:

```
class="text-sm text-gray-600 dark:text-gray-400"
```

The stat-card big-number text is repeated identically 4 times (the bottleneck count card uses `text-red-600` instead and is handled separately below). Using `replace_all: true`, change every occurrence of:

```
class="text-3xl font-bold text-gray-900"
```

to:

```
class="text-3xl font-bold text-gray-900 dark:text-gray-100"
```

The bottleneck count uses a different class, once:

```vue
              <p class="text-3xl font-bold text-red-600">{{ entry.count }}</p>
```

to:

```vue
              <p class="text-3xl font-bold text-red-600 dark:text-red-400">{{ entry.count }}</p>
```

The table row divider is repeated identically 2 times (Produtividade and Gargalos tables). Using `replace_all: true`, change every occurrence of:

```
class="min-w-full divide-y divide-gray-200"
```

to:

```
class="min-w-full divide-y divide-gray-200 dark:divide-gray-700"
```

The table header cell class is repeated identically 6 times (3 columns × 2 tables). Using `replace_all: true`, change every occurrence of:

```
class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase"
```

to:

```
class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-400"
```

(Table `<td>` cells have no explicit color class — they already inherit the correct light/dark text color from `<body>`, paired in Task 2. No change needed there.)

Change the "Ver no painel" link, once:

```vue
                    <RouterLink to="/wms/operations" class="text-primary-600 hover:underline">Ver no painel</RouterLink>
```

to:

```vue
                    <RouterLink to="/wms/operations" class="text-primary-600 dark:text-primary-400 hover:underline">Ver no painel</RouterLink>
```

- [ ] **Step 3: Run tests to verify the template changes don't break the existing suite**

Run: `cd frontend && npx vitest run src/views/wms/__tests__/WmsKpiDashboardView.spec.ts`
Expected: PASS — 8 tests (Task 4 already added the `theme.store` mock to this file; the template edits above don't remove any `data-testid` or text content the tests assert on).

- [ ] **Step 4: Write the failing test for Chart.js theming**

The mocked `Chart` class in this spec file (`MockChart`) already captures the full `config` object passed to `new Chart(...)`, so asserting on `config.options.scales.x.ticks.color` requires no new mocking infrastructure. Add this test to `frontend/src/views/wms/__tests__/WmsKpiDashboardView.spec.ts`, inside the existing `describe('WmsKpiDashboardView', ...)` block, after the `'createCharts() monta os 3 gráficos...'` test:

```typescript
  it('usa cores de grade/texto claras nos 3 gráficos quando o tema está escuro', async () => {
    vi.mocked(wmsKpiService.getTaskKpis).mockResolvedValue(mockTaskKpis as any)
    vi.mocked(wmsKpiService.getOccupancy).mockResolvedValue(mockOccupancy as any)
    vi.mocked(useThemeStore).mockReturnValue({ mode: 'dark', isDark: true, setMode: vi.fn() } as any)

    const router = makeRouter()
    router.push('/wms/kpis')
    await router.isReady()

    mount(WmsKpiDashboardView, { global: { plugins: [router] } })
    await flushPromises()
    vi.advanceTimersByTime(100)
    await flushPromises()

    const [volumeChart] = chartInstances
    expect(volumeChart.config.options.scales.x.ticks.color).toBe('#e5e7eb')
    expect(volumeChart.config.options.scales.x.grid.color).toBe('#374151')
  })
```

This test needs `useThemeStore` imported and mocked as a spy (not the plain object the other tests get by default), so change the existing mock at the top of the file from:

```typescript
vi.mock('@/stores/theme.store', () => ({
  useThemeStore: () => ({ mode: 'system', isDark: false, setMode: vi.fn() }),
}))
```

to:

```typescript
vi.mock('@/stores/theme.store', () => ({
  useThemeStore: vi.fn(() => ({ mode: 'system', isDark: false, setMode: vi.fn() })),
}))
```

and add the import, alongside the existing `wmsKpiService` import at the top of the file:

```typescript
import { useThemeStore } from '@/stores/theme.store'
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/views/wms/__tests__/WmsKpiDashboardView.spec.ts -t "cores de grade"`
Expected: FAIL — `Cannot read properties of undefined (reading 'color')`, because `createCharts()` doesn't set `ticks`/`grid` colors yet.

- [ ] **Step 6: Implement the Chart.js theming**

In `frontend/src/views/wms/WmsKpiDashboardView.vue`, change the imports and add the theme store + color computeds:

```typescript
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import AppLayout from '@/components/common/AppLayout.vue'
import Button from '@/components/common/Button.vue'
import Card from '@/components/common/Card.vue'
import wmsKpiService from '@/services/wms-kpi.service'
import type { WmsTaskKpis, OccupancyResponse } from '@/types/wms-kpi.types'
import Chart from 'chart.js/auto'
```

to:

```typescript
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import AppLayout from '@/components/common/AppLayout.vue'
import Button from '@/components/common/Button.vue'
import Card from '@/components/common/Card.vue'
import wmsKpiService from '@/services/wms-kpi.service'
import type { WmsTaskKpis, OccupancyResponse } from '@/types/wms-kpi.types'
import Chart from 'chart.js/auto'
import { useThemeStore } from '@/stores/theme.store'

const themeStore = useThemeStore()
const chartTextColor = computed(() => (themeStore.isDark ? '#e5e7eb' : '#374151'))
const chartGridColor = computed(() => (themeStore.isDark ? '#374151' : '#e5e7eb'))
```

(Place these two new lines right after the existing `const overallOccupancyPercent = computed(...)` block, before `const volumeChartRef = ref<HTMLCanvasElement | null>(null)`.)

Change the `volumeChart` options:

```typescript
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } },
      },
    })
  }

  if (cycleChartRef.value && taskKpis.value) {
```

to:

```typescript
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { stacked: true, ticks: { color: chartTextColor.value }, grid: { color: chartGridColor.value } },
          y: { stacked: true, beginAtZero: true, ticks: { color: chartTextColor.value }, grid: { color: chartGridColor.value } },
        },
        plugins: { legend: { labels: { color: chartTextColor.value } } },
      },
    })
  }

  if (cycleChartRef.value && taskKpis.value) {
```

Change the `cycleChart` options:

```typescript
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true } },
      },
    })
  }

  if (occupancyChartRef.value && occupancy.value) {
```

to:

```typescript
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, ticks: { color: chartTextColor.value }, grid: { color: chartGridColor.value } },
          y: { ticks: { color: chartTextColor.value }, grid: { color: chartGridColor.value } },
        },
      },
    })
  }

  if (occupancyChartRef.value && occupancy.value) {
```

Change the `occupancyChart` options:

```typescript
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } },
      },
    })
  }
}
```

to:

```typescript
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { stacked: true, ticks: { color: chartTextColor.value }, grid: { color: chartGridColor.value } },
          y: { stacked: true, beginAtZero: true, ticks: { color: chartTextColor.value }, grid: { color: chartGridColor.value } },
        },
        plugins: { legend: { labels: { color: chartTextColor.value } } },
      },
    })
  }
}
```

Finally, recreate the charts when the theme flips (mirrors the existing `watch(days, ...)` pattern). Change:

```typescript
watch(days, async () => {
  await loadTaskKpis()
  setTimeout(createCharts, 100)
})
```

to:

```typescript
watch(days, async () => {
  await loadTaskKpis()
  setTimeout(createCharts, 100)
})

watch(
  () => themeStore.isDark,
  () => {
    if (!loading.value) createCharts()
  }
)
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/views/wms/__tests__/WmsKpiDashboardView.spec.ts`
Expected: PASS — 9 tests (8 existing + the new theming test).

- [ ] **Step 8: Run the full frontend suite and type-check to confirm no regressions**

Run: `cd frontend && npm test`
Expected: PASS — same file count as Task 6's baseline, plus 1 new test in `WmsKpiDashboardView.spec.ts`.

Run: `cd frontend && npx vue-tsc --noEmit`
Expected: same error count as the project baseline (48 as of this plan's writing) — no new errors introduced.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/views/wms/WmsKpiDashboardView.vue frontend/src/views/wms/__tests__/WmsKpiDashboardView.spec.ts
git commit -m "feat(dark-mode): retrofita WmsKpiDashboardView.vue, inclusive cores dos graficos Chart.js"
```

---

### Task 8: Manual visual verification

**Files:** none (verification-only task, no code changes).

**Interfaces:** none.

- [ ] **Step 1: Rebuild/restart the frontend dev container**

This project's dev server has known HMR staleness on this Windows/Docker setup — always restart before trusting a screenshot:

```bash
docker compose -p fabric restart frontend
```

- [ ] **Step 2: Verify `DashboardView` in both modes**

Using a real browser session (or Playwright, matching the pattern already used in this project's `Fase 2 Task 8` verification):
1. Log in, land on `/dashboard`.
2. Click the `ThemeToggle` button in the header until it reaches dark mode (icon becomes a moon).
3. Confirm: page background is dark, header is dark, module cards are dark with light text, and the active tab's underline/text is still legible.
4. Click again to cycle to "Sistema" then to "Claro" — confirm the page returns to the original light appearance pixel-for-pixel.

- [ ] **Step 3: Verify `WmsKpiDashboardView` in both modes**

1. Navigate to `/wms/kpis`.
2. Toggle to dark mode.
3. Confirm: stat cards, tables, and all 5 tab panels are dark with legible text; switch through all 5 tabs to check each one.
4. Confirm the 3 Chart.js graphs (Volume/Status, Tempo de Ciclo, Ocupação) render with light-colored axis labels/grid lines readable against the dark card background (not the default dark-on-dark).
5. Change the period selector (7/30/90 dias) while in dark mode — confirm the charts are recreated with the same dark-mode colors (not reverting to light-mode chart colors).

- [ ] **Step 4: Confirm the toggle persists across a reload**

1. While in dark mode, reload the page.
2. Confirm the app comes back up already in dark mode (proves `localStorage` persistence + `initialize()` wiring works end-to-end, not just within a single SPA session).

- [ ] **Step 5: Report results**

No commit for this task. If any visual issue is found, fix it as a small follow-up commit against the specific file/class identified, then re-run the affected step above.

---

## Post-plan: what's still queued

The remaining ~50 views/components in the app keep their light-only appearance after this plan — that's the explicit Fase 1 scope boundary from the spec. Retrofitting them (using the same conversion recipe documented in the spec and exercised in Tasks 6/7) is queued as future incremental batches, same pattern as the earlier 8-batch frontend migration.
