import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import ChatAssistant from '../ChatAssistant.vue'
import { useAssistantStore } from '@/stores/assistant.store'
import { streamChat } from '@/services/assistant.service'

const { hasPermissionMock } = vi.hoisted(() => ({ hasPermissionMock: vi.fn() }))

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ hasPermission: hasPermissionMock }),
}))

vi.mock('@/services/assistant.service', () => ({
  streamChat: vi.fn(),
}))

// ChatAssistant renderiza dentro de <Teleport to="body">: o conteudo vai para
// document.body como IRMAO da raiz montada, entao fica FORA da arvore que
// wrapper.find()/wrapper.text() alcancam (mesma limitacao ja documentada em
// AppModal.spec.ts:17-19, verificada empiricamente com @vue/test-utils 2.5.0 /
// vue 3.5.22: nem attachTo muda isso). Por isso consultamos e interagimos via
// document.body diretamente para tudo que vive dentro do teleport.
function openButton(): HTMLButtonElement | null {
  return document.body.querySelector('button[aria-label="Abrir assistente virtual"]')
}

function inputEl(): HTMLInputElement | null {
  return document.body.querySelector('input[type="text"]')
}

function formEl(): HTMLFormElement | null {
  return document.body.querySelector('form')
}

function click(el: HTMLElement): void {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
}

async function setInputValue(el: HTMLInputElement, value: string): Promise<void> {
  el.value = value
  el.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()
}

async function submitForm(form: HTMLFormElement): Promise<void> {
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  await nextTick()
}

describe('ChatAssistant', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    document.body.innerHTML = ''
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('não renderiza o balão quando o usuário não tem a permissão assistente_ia:usar', () => {
    hasPermissionMock.mockReturnValue(false)
    mount(ChatAssistant, { attachTo: document.body })
    expect(openButton()).toBeNull()
  })

  it('renderiza o balão quando o usuário tem a permissão', () => {
    hasPermissionMock.mockReturnValue(true)
    mount(ChatAssistant, { attachTo: document.body })
    expect(openButton()).not.toBeNull()
  })

  it('abre o painel e envia uma mensagem ao submeter o formulário', async () => {
    hasPermissionMock.mockReturnValue(true)
    vi.mocked(streamChat).mockImplementation(async (_msg, _history, handlers) => {
      handlers.onToken('Resposta do assistente')
      handlers.onDone()
    })

    mount(ChatAssistant, { attachTo: document.body })
    click(openButton()!)
    await nextTick()

    await setInputValue(inputEl()!, 'qual o procedimento de contagem?')
    await submitForm(formEl()!)
    await nextTick()
    await new Promise((resolve) => setTimeout(resolve, 0))

    const store = useAssistantStore()
    expect(store.messages).toHaveLength(2)
    expect(document.body.textContent).toContain('Resposta do assistente')
  })

  it('exibe a mensagem de erro do store quando o assistente falha', async () => {
    hasPermissionMock.mockReturnValue(true)
    vi.mocked(streamChat).mockImplementation(async (_msg, _history, handlers) => {
      handlers.onError('Falha de conexão')
    })

    mount(ChatAssistant, { attachTo: document.body })
    click(openButton()!)
    await nextTick()

    await setInputValue(inputEl()!, 'oi')
    await submitForm(formEl()!)
    await nextTick()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(document.body.textContent).toContain('Falha de conexão')
  })

  it('desabilita o campo e o botão de enviar durante o streaming', async () => {
    hasPermissionMock.mockReturnValue(true)
    let resolveStream: () => void = () => {}
    vi.mocked(streamChat).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveStream = () => resolve(undefined)
        })
    )

    mount(ChatAssistant, { attachTo: document.body })
    click(openButton()!)
    await nextTick()

    await setInputValue(inputEl()!, 'oi')
    await submitForm(formEl()!)
    await nextTick()

    expect(inputEl()!.disabled).toBe(true)

    resolveStream()
    await nextTick()
  })
})
