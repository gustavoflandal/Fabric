import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAssistantStore } from '../assistant.store'
import { streamChat } from '@/services/assistant.service'

vi.mock('@/services/assistant.service', () => ({
  streamChat: vi.fn(),
}))

describe('useAssistantStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('adiciona a mensagem do usuário e acumula os tokens da resposta do assistente', async () => {
    vi.mocked(streamChat).mockImplementation(async (_msg, _history, handlers) => {
      handlers.onToken('Olá')
      handlers.onToken(', tudo bem?')
      handlers.onSources([{ arquivo: 'a.pdf', trecho: 't' }])
      handlers.onDone()
    })

    const store = useAssistantStore()
    await store.sendMessage('oi')

    expect(store.messages).toHaveLength(2)
    expect(store.messages[0]).toMatchObject({ role: 'user', content: 'oi' })
    expect(store.messages[1]).toMatchObject({
      role: 'assistant',
      content: 'Olá, tudo bem?',
      sources: [{ arquivo: 'a.pdf', trecho: 't' }],
    })
    expect(store.isStreaming).toBe(false)
  })

  it('marca erro na mensagem do assistente quando o stream falha', async () => {
    vi.mocked(streamChat).mockImplementation(async (_msg, _history, handlers) => {
      handlers.onError('Falha de conexão')
    })

    const store = useAssistantStore()
    await store.sendMessage('oi')

    expect(store.messages[1]).toMatchObject({ error: true })
    expect(store.error).toBe('Falha de conexão')
    expect(store.isStreaming).toBe(false)
  })

  it('envia só as últimas 6 mensagens como histórico da requisição', async () => {
    vi.mocked(streamChat).mockImplementation(async (_msg, _history, handlers) => handlers.onDone())

    const store = useAssistantStore()
    for (let i = 0; i < 5; i++) {
      await store.sendMessage(`pergunta ${i}`)
    }

    const lastCallHistory = vi.mocked(streamChat).mock.calls.at(-1)?.[1]
    expect(lastCallHistory?.length).toBeLessThanOrEqual(6)
  })

  it('clear() limpa as mensagens e o erro', async () => {
    vi.mocked(streamChat).mockImplementation(async (_msg, _history, handlers) => handlers.onDone())
    const store = useAssistantStore()
    await store.sendMessage('oi')

    store.clear()

    expect(store.messages).toEqual([])
    expect(store.error).toBeNull()
  })
})
