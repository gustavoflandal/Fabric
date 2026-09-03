import { describe, expect, it, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import AppModal from '../AppModal.vue'

// AppModal so se justifica pelo COMPORTAMENTO: Esc, clique no overlay, foco ao
// abrir, devolucao do foco ao fechar e focus trap (§4.2, portado de
// ConfirmDialogContainer.vue:55-89). Sem esses testes, nada foi provado.
function mountModal(props: Record<string, unknown> = {}, slots: Record<string, string> = {}) {
  return mount(AppModal, {
    props: { modelValue: true, title: 'Nova Tarefa', ...props },
    slots: { default: '<input id="campo-a" /><input id="campo-b" />', ...slots },
    attachTo: document.body,
  })
}

// O conteudo vai para <Teleport to="body">, entao fica FORA da arvore do wrapper:
// wrapper.find() nao o alcanca. As consultas e os eventos vao pelo DOM real.
const overlayEl = () => document.body.querySelector('.fixed.inset-0') as HTMLElement
const dialogEl = () => document.body.querySelector('[role="dialog"]') as HTMLElement

function press(el: HTMLElement, key: string, shiftKey = false): void {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true }))
}

function click(el: HTMLElement): void {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

describe('AppModal', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('nao renderiza nada quando modelValue e false', () => {
    mount(AppModal, { props: { modelValue: false }, attachTo: document.body })
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
  })

  it('renderiza o overlay e a caixa canonicos quando aberto', () => {
    mountModal()
    const overlay = document.body.querySelector('.fixed.inset-0') as HTMLElement
    expect(overlay).not.toBeNull()
    for (const c of ['bg-black', 'bg-opacity-50', 'flex', 'items-center', 'justify-center', 'z-50', 'p-4']) {
      expect(overlay.classList.contains(c)).toBe(true)
    }
    const box = document.body.querySelector('[role="dialog"]') as HTMLElement
    expect(box.classList.contains('max-w-2xl')).toBe(true)
    expect(box.classList.contains('max-h-[90vh]')).toBe(true)
  })

  it('aplica o tamanho maior via prop size', () => {
    mountModal({ size: 'lg' })
    const box = document.body.querySelector('[role="dialog"]') as HTMLElement
    expect(box.classList.contains('max-w-4xl')).toBe(true)
  })

  it('fecha com a tecla Esc emitindo update:modelValue false', async () => {
    const wrapper = mountModal()
    press(dialogEl(), 'Escape')
    await nextTick()
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false])
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('fecha ao clicar no overlay, mas nao ao clicar dentro da caixa', async () => {
    const wrapper = mountModal()
    click(dialogEl())
    await nextTick()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    click(overlayEl())
    await nextTick()
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false])
  })

  it('tem botao de fechar com aria-label="Fechar" que fecha o modal', async () => {
    const wrapper = mountModal()
    const closeBtn = document.body.querySelector('button[aria-label="Fechar"]') as HTMLElement
    expect(closeBtn).not.toBeNull()
    click(closeBtn)
    await nextTick()
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false])
  })

  it('move o foco para dentro do modal ao abrir', async () => {
    const wrapper = mount(AppModal, {
      props: { modelValue: false, title: 'T' },
      slots: { default: '<input id="campo-a" />' },
      attachTo: document.body,
    })
    await wrapper.setProps({ modelValue: true })
    await nextTick()
    await nextTick()
    expect(document.activeElement?.id).toBe('campo-a')
  })

  it('devolve o foco ao elemento anterior quando fecha', async () => {
    const trigger = document.createElement('button')
    trigger.id = 'gatilho'
    document.body.appendChild(trigger)
    trigger.focus()
    expect(document.activeElement?.id).toBe('gatilho')

    const wrapper = mount(AppModal, {
      props: { modelValue: false, title: 'T' },
      slots: { default: '<input id="campo-a" />' },
      attachTo: document.body,
    })

    await wrapper.setProps({ modelValue: true })
    await nextTick()
    await nextTick()
    expect(document.activeElement?.id).toBe('campo-a')

    await wrapper.setProps({ modelValue: false })
    await nextTick()
    expect(document.activeElement?.id).toBe('gatilho')
  })

  it('faz focus trap: Tab no ultimo focavel volta para o primeiro', async () => {
    mountModal()
    const focusables = dialogEl().querySelectorAll<HTMLElement>('button, input')
    const first = focusables[0]
    const last = focusables[focusables.length - 1]

    last.focus()
    press(last, 'Tab')
    await nextTick()
    expect(document.activeElement).toBe(first)
  })

  it('faz focus trap: Shift+Tab no primeiro focavel vai para o ultimo', async () => {
    mountModal()
    const focusables = dialogEl().querySelectorAll<HTMLElement>('button, input')
    const first = focusables[0]
    const last = focusables[focusables.length - 1]

    first.focus()
    press(first, 'Tab', true)
    await nextTick()
    expect(document.activeElement).toBe(last)
  })

  it('expoe role=dialog, aria-modal e aria-label com o titulo', () => {
    mountModal({ title: 'Editar Fornecedor' })
    const box = document.body.querySelector('[role="dialog"]') as HTMLElement
    expect(box.getAttribute('aria-modal')).toBe('true')
    expect(box.getAttribute('aria-label')).toBe('Editar Fornecedor')
  })
})
