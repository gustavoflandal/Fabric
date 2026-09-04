import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ConditionRuleBuilder from '../ConditionRuleBuilder.vue'

describe('ConditionRuleBuilder', () => {
  it('mostra o botão de adicionar condição quando modelValue é null', () => {
    const wrapper = mount(ConditionRuleBuilder, { props: { modelValue: null } })
    expect(wrapper.text()).toContain('adicionar condição')
  })

  it('emite update:modelValue com uma condição simples ao clicar em "+ adicionar condição"', async () => {
    const wrapper = mount(ConditionRuleBuilder, { props: { modelValue: null } })
    await wrapper.find('button').trigger('click')

    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toBeTruthy()
    expect(emitted![0][0]).toMatchObject({ operator: 'eq' })
  })

  it('renderiza um grupo AND/OR com seus clauses filhos', () => {
    const wrapper = mount(ConditionRuleBuilder, {
      props: {
        modelValue: {
          op: 'AND',
          clauses: [{ field: 'product.weight', operator: 'gt', value: 500 }],
        },
      },
    })
    expect(wrapper.find('select').exists()).toBe(true)
    expect(wrapper.text()).toContain('E (todas as condições)')
  })

  it('emite null ao remover uma condição simples', async () => {
    const wrapper = mount(ConditionRuleBuilder, {
      props: { modelValue: { field: 'product.weight', operator: 'gt', value: 500 } },
    })
    const removeButton = wrapper.findAll('button').find((b) => b.text() === '✕')!
    await removeButton.trigger('click')

    expect(wrapper.emitted('update:modelValue')![0][0]).toBeNull()
  })

  it('reage corretamente quando modelValue muda após a montagem (reatividade)', async () => {
    const wrapper = mount(ConditionRuleBuilder, { props: { modelValue: null } })

    // Inicialmente deve mostrar o botão de adicionar condição
    expect(wrapper.text()).toContain('adicionar condição')

    // Agora atualiza o prop com uma condição leaf
    await wrapper.setProps({
      modelValue: { field: 'product.weight', operator: 'eq', value: 1 },
    })

    // Deve renderizar os controles da condição leaf (selects e input)
    const selects = wrapper.findAll('select')
    expect(selects.length).toBeGreaterThan(0)
    expect(wrapper.find('input').exists()).toBe(true)
  })
})
