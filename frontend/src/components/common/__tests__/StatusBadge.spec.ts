import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import StatusBadge from '../StatusBadge.vue'

describe('StatusBadge', () => {
  it('renderiza o label recebido', () => {
    const wrapper = mount(StatusBadge, { props: { label: 'Ativo', tone: 'success' } })
    expect(wrapper.text()).toBe('Ativo')
  })

  // A razao de existir do componente: um unico mapa tone -> par bg/text, no lugar
  // das 9 reimplementacoes de getStatusClass (I14). Se o mapa mudar, o teste quebra.
  it.each([
    ['success', 'bg-green-100', 'text-green-800'],
    ['danger', 'bg-red-100', 'text-red-800'],
    ['warning', 'bg-yellow-100', 'text-yellow-800'],
    ['neutral', 'bg-gray-100', 'text-gray-800'],
    ['info', 'bg-blue-100', 'text-blue-800'],
  ] as const)('mapeia tone "%s" para %s / %s', (tone, bg, text) => {
    const wrapper = mount(StatusBadge, { props: { label: 'X', tone } })
    const classes = wrapper.classes()
    expect(classes).toContain(bg)
    expect(classes).toContain(text)
  })

  it('mantem as classes base do badge do sistema', () => {
    const wrapper = mount(StatusBadge, { props: { label: 'X' } })
    const classes = wrapper.classes()
    for (const c of ['inline-flex', 'items-center', 'px-2.5', 'py-0.5', 'rounded-full', 'text-xs', 'font-medium']) {
      expect(classes).toContain(c)
    }
  })

  it('usa tone neutral por padrao', () => {
    const wrapper = mount(StatusBadge, { props: { label: 'Rascunho' } })
    expect(wrapper.classes()).toContain('bg-gray-100')
  })
})
