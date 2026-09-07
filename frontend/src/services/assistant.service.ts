import { useAuthStore } from '@/stores/auth.store'
import type { AssistantHistoryMessage, AssistantStreamHandlers } from '@/types/assistant.types'

const baseURL = import.meta.env.VITE_API_URL || '/api/v1'

interface SseEvent {
  event: string
  data: string
}

function parseSseBlock(block: string): SseEvent | null {
  const lines = block.split('\n')
  let event = 'message'
  let data = ''

  for (const line of lines) {
    if (line.startsWith('event:')) event = line.slice(6).trim()
    if (line.startsWith('data:')) data = line.slice(5).trim()
  }

  return data ? { event, data } : null
}

/**
 * Consome o SSE de POST /assistant/chat via `fetch` + leitor de stream —
 * `EventSource` não serve aqui: não suporta POST nem header de Authorization
 * (spec seção 5).
 */
export async function streamChat(
  message: string,
  history: AssistantHistoryMessage[],
  handlers: AssistantStreamHandlers
): Promise<void> {
  const authStore = useAuthStore()

  try {
    const response = await fetch(`${baseURL}/assistant/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.accessToken}`,
      },
      body: JSON.stringify({ message, history }),
    })

    if (!response.ok || !response.body) {
      handlers.onError('Não foi possível conectar ao assistente.')
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      let separatorIndex
      while ((separatorIndex = buffer.indexOf('\n\n')) >= 0) {
        const block = buffer.slice(0, separatorIndex)
        buffer = buffer.slice(separatorIndex + 2)

        const parsed = parseSseBlock(block)
        if (!parsed) continue

        const payload = JSON.parse(parsed.data)

        if (parsed.event === 'token') handlers.onToken(payload.text)
        else if (parsed.event === 'fontes') handlers.onSources(payload.sources)
        else if (parsed.event === 'consulta') handlers.onConsulta(payload)
        else if (parsed.event === 'fim') handlers.onDone()
        else if (parsed.event === 'erro') handlers.onError(payload.message)
      }
    }
  } catch {
    handlers.onError('Falha ao processar a resposta do assistente.')
  }
}
