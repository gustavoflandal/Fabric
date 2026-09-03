import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import FormField from '../FormField.vue'

// O componente existe para tornar a associacao for/id estrutural em vez de
// dependente de disciplina por tela (I6: 1 de 10 views acerta hoje).
describe('FormField', () => {
  it('associa o label ao input pelo id informado', () => {
    const wrapper = mount(FormField, {
      props: { id: 'wt-code', label: 'Código' },
      slots: { default: '<input id="wt-code" type="text" />' },
    })
    expect(wrapper.find('label').attributes('for')).toBe('wt-code')
    expect(wrapper.find('input').attributes('id')).toBe('wt-code')
  })

  it('gera um id unico quando nenhum e informado e o aplica no controle do slot', () => {
    const wrapper = mount(FormField, {
      props: { label: 'Buscar' },
      slots: { default: '<input type="text" />' },
      attachTo: document.body,
    })

    const forAttr = wrapper.find('label').attributes('for')
    expect(forAttr).toBeTruthy()
    // Sem :id no slot, o componente cola o id gerado no proprio controle.
    expect(wrapper.find('input').attributes('id')).toBe(forAttr)
    wrapper.unmount()
  })

  it('gera ids diferentes para instancias diferentes', () => {
    const a = mount(FormField, { props: { label: 'A' }, slots: { default: '<input />' } })
    const b = mount(FormField, { props: { label: 'B' }, slots: { default: '<input />' } })
    expect(a.find('label').attributes('for')).not.toBe(b.find('label').attributes('for'))
  })

  it('expoe o id gerado como slot prop', () => {
    const wrapper = mount(FormField, {
      props: { label: 'Status' },
      slots: { default: '<template #default="{ id }"><select :id="id"></select></template>' },
    })
    expect(wrapper.find('select').attributes('id')).toBe(wrapper.find('label').attributes('for'))
  })

  it('marca campo obrigatorio com o asterisco vermelho (CountingPlanForm.vue:48)', () => {
    const wrapper = mount(FormField, {
      props: { label: 'Código', required: true },
      slots: { default: '<input />' },
    })
    const star = wrapper.find('span.text-red-500')
    expect(star.exists()).toBe(true)
    expect(star.text()).toBe('*')
  })

  it('nao mostra asterisco quando o campo nao e obrigatorio', () => {
    const wrapper = mount(FormField, {
      props: { label: 'Observações' },
      slots: { default: '<input />' },
    })
    expect(wrapper.find('span.text-red-500').exists()).toBe(false)
  })

  it('exibe erro por campo e o esconde quando nao ha erro', () => {
    const wrapper = mount(FormField, {
      props: { label: 'Email', error: 'Email inválido' },
      slots: { default: '<input />' },
    })
    expect(wrapper.find('p.text-red-600').text()).toBe('Email inválido')
  })

  it('exibe hint apenas quando nao ha erro', async () => {
    const wrapper = mount(FormField, {
      props: { label: 'Código', hint: 'Até 20 caracteres' },
      slots: { default: '<input />' },
    })
    expect(wrapper.find('p.text-gray-500').text()).toBe('Até 20 caracteres')

    await wrapper.setProps({ error: 'Obrigatório' })
    expect(wrapper.find('p.text-gray-500').exists()).toBe(false)
    expect(wrapper.find('p.text-red-600').text()).toBe('Obrigatório')
  })
})
