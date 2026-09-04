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

  // F-WORKFLOW-FIX3 — regressão: antes, `coerceValue` rodava em todo @input e
  // o número coercionado voltava via v-model, reescrevendo o DOM com
  // `String(rule.value)` no meio da digitação — "1." virava "1" e o usuário
  // nunca conseguia terminar de digitar "1.5". Agora o @input só atualiza o
  // ref local (sem emitir); coação + emit só no @blur.
  it('permite digitar um valor decimal ("1.5") sem que o "." seja apagado, emitindo o número só no blur', async () => {
    const wrapper = mount(ConditionRuleBuilder, {
      props: { modelValue: { field: 'product.weight', operator: 'gt', value: 0 } },
    })
    const input = wrapper.find('input')

    await input.setValue('1.5')
    // Ainda não deve ter emitido nada por causa do "." (nenhum evento de
    // input deve ter disparado update:modelValue com o valor coercionado).
    expect((input.element as HTMLInputElement).value).toBe('1.5')

    await input.trigger('blur')

    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toBeTruthy()
    const lastEmitted = emitted![emitted!.length - 1][0] as { value: unknown }
    expect(lastEmitted.value).toBe(1.5)
  })

  // F-WORKFLOW-FIX4 — regressão: "+ subgrupo" não pode mais gerar
  // `clauses: []`, porque o Joi do backend exige `.min(1)` (grupo AND vazio
  // avaliaria `true`). O novo subgrupo nasce com uma leaf vazia dentro.
  it('semeia um novo subgrupo com uma leaf vazia dentro, nunca com clauses: []', async () => {
    const wrapper = mount(ConditionRuleBuilder, {
      props: { modelValue: { op: 'AND', clauses: [{ field: 'product.weight', operator: 'gt', value: 500 }] } },
    })
    const subgrupoButton = wrapper.findAll('button').find((b) => b.text() === '+ subgrupo')!
    await subgrupoButton.trigger('click')

    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toBeTruthy()
    const newGroup = (emitted![0][0] as any).clauses[1]
    expect(newGroup).toEqual({ op: 'AND', clauses: [{ field: 'product.weight', operator: 'eq', value: '' }] })
  })
})
