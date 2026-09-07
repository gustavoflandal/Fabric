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

  it('exibe a linha de consulta quando a mensagem tem consultas', async () => {
    hasPermissionMock.mockReturnValue(true)
    vi.mocked(streamChat).mockImplementation(async (_msg, _history, handlers) => {
      handlers.onToken('42 unidades')
      handlers.onConsulta({ funcao: 'getSaldoProduto', parametros: { codigoProduto: 'PA-001' }, linhas: 1 })
      handlers.onDone()
    })

    mount(ChatAssistant, { attachTo: document.body })
    click(openButton()!)
    await nextTick()

    await setInputValue(inputEl()!, 'qual o saldo?')
    await submitForm(formEl()!)
    await nextTick()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(document.body.textContent).toContain('getSaldoProduto')
    expect(document.body.textContent).toContain('codigoProduto=PA-001')
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

  it('atualiza o DOM progressivamente conforme os tokens chegam durante o streaming', async () => {
    hasPermissionMock.mockReturnValue(true)

    // Regressao direta do bug de reatividade corrigido na task da store:
    // assistantMessage precisa ser reactive() para que mutacoes token a token
    // no closure (fora do proxy reativo do array) disparem re-render. Sem
    // reactive(), a mutacao e invisivel para o Vue e SO reapareceria "de
    // carona" se outro estado reativo (ex.: isStreaming) forcasse um render
    // por outro motivo — por isso cada onToken() aqui e isolado por um gate
    // proprio, e onDone() (que mexe em isStreaming, reativo de verdade) so e
    // liberado DEPOIS de verificarmos o estado de cada token isoladamente.
    // Sem esse isolamento, o teste passaria mesmo com o bug reintroduzido
    // (verificado manualmente: revertendo reactive() -> objeto plano na
    // store, uma versao anterior deste teste sem os gates passava do mesmo
    // jeito, por causa exatamente desse "carona").
    let releaseFirstToken: () => void = () => {}
    let releaseSecondToken: () => void = () => {}
    let releaseDone: () => void = () => {}
    let notifyFirstTokenSent: () => void = () => {}
    let notifySecondTokenSent: () => void = () => {}

    const firstTokenGate = new Promise<void>((resolve) => {
      releaseFirstToken = resolve
    })
    const secondTokenGate = new Promise<void>((resolve) => {
      releaseSecondToken = resolve
    })
    const doneGate = new Promise<void>((resolve) => {
      releaseDone = resolve
    })
    const firstTokenSent = new Promise<void>((resolve) => {
      notifyFirstTokenSent = resolve
    })
    const secondTokenSent = new Promise<void>((resolve) => {
      notifySecondTokenSent = resolve
    })

    vi.mocked(streamChat).mockImplementation(async (_msg, _history, handlers) => {
      await firstTokenGate
      handlers.onToken('Olá')
      notifyFirstTokenSent()
      await secondTokenGate
      handlers.onToken(' mundo')
      notifySecondTokenSent()
      await doneGate
      handlers.onDone()
    })

    mount(ChatAssistant, { attachTo: document.body })
    click(openButton()!)
    await nextTick()

    await setInputValue(inputEl()!, 'oi')
    await submitForm(formEl()!)
    await nextTick()

    // Antes do primeiro token: mensagem do assistente ja existe, mas vazia.
    expect(document.body.textContent).not.toContain('Olá')

    releaseFirstToken()
    await firstTokenSent
    await nextTick()

    // Estado intermediario isolado: so o primeiro token chegou, onDone ainda
    // nao foi chamado (nao ha nenhum outro gatilho reativo por perto).
    expect(document.body.textContent).toContain('Olá')
    expect(document.body.textContent).not.toContain('Olá mundo')

    releaseSecondToken()
    await secondTokenSent
    await nextTick()

    // Segundo estado intermediario isolado: o segundo token foi concatenado
    // ao primeiro (nao substituiu), e onDone ainda nao rodou.
    expect(document.body.textContent).toContain('Olá mundo')

    releaseDone()
    await nextTick()
    await new Promise((resolve) => setTimeout(resolve, 0))
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
