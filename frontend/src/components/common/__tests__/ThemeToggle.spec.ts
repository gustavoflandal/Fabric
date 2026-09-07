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
