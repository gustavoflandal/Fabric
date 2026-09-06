import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { streamChat } from '../assistant.service'

function makeReader(chunks: string[]) {
  let i = 0
  return {
    read: vi.fn(async () => {
      if (i >= chunks.length) return { done: true, value: undefined }
      const value = new TextEncoder().encode(chunks[i])
      i += 1
      return { done: false, value }
    }),
  }
}

describe('assistant.service.streamChat', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('invoca onToken, onSources e onDone conforme os eventos SSE chegam', async () => {
    const sseBody =
      'event: token\ndata: {"text":"Olá"}\n\n' +
      'event: fontes\ndata: {"sources":[{"arquivo":"a.pdf","trecho":"t"}]}\n\n' +
      'event: fim\ndata: {}\n\n'

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: { getReader: () => makeReader([sseBody]) },
    }) as any

    const onToken = vi.fn()
    const onSources = vi.fn()
    const onDone = vi.fn()
    const onError = vi.fn()

    await streamChat('oi', [], { onToken, onSources, onDone, onError })

    expect(onToken).toHaveBeenCalledWith('Olá')
    expect(onSources).toHaveBeenCalledWith([{ arquivo: 'a.pdf', trecho: 't' }])
    expect(onDone).toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
  })

  it('processa eventos SSE que chegam fatiados em múltiplos chunks de rede', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: {
        getReader: () =>
          makeReader(['event: token\ndata: {"tex', 't":"Olá"}\n\n', 'event: fim\ndata: {}\n\n']),
      },
    }) as any

    const onToken = vi.fn()
    const onDone = vi.fn()

    await streamChat('oi', [], { onToken, onSources: vi.fn(), onDone, onError: vi.fn() })

    expect(onToken).toHaveBeenCalledWith('Olá')
    expect(onDone).toHaveBeenCalled()
  })

  it('chama onError quando a resposta HTTP não é ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, body: null }) as any

    const onError = vi.fn()
    await streamChat('oi', [], { onToken: vi.fn(), onSources: vi.fn(), onDone: vi.fn(), onError })

    expect(onError).toHaveBeenCalledWith('Não foi possível conectar ao assistente.')
  })

  it('repassa o evento erro vindo do servidor (após o 200 já enviado)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: { getReader: () => makeReader(['event: erro\ndata: {"message":"Falha ao gerar resposta. Tente novamente."}\n\n']) },
    }) as any

    const onError = vi.fn()
    await streamChat('oi', [], { onToken: vi.fn(), onSources: vi.fn(), onDone: vi.fn(), onError })

    expect(onError).toHaveBeenCalledWith('Falha ao gerar resposta. Tente novamente.')
  })
})
