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
