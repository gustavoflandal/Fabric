import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'
import { streamChat } from '@/services/assistant.service'
import type { AssistantMessage, AssistantHistoryMessage } from '@/types/assistant.types'

let nextId = 0
const generateId = () => `msg-${Date.now()}-${nextId++}`

/**
 * Sem persistência — mensagens vivem só em memória desta store, perdidas ao
 * recarregar a página (spec seção 3/5, decisão "apenas sessão atual").
 */
export const useAssistantStore = defineStore('assistant', () => {
  const messages = ref<AssistantMessage[]>([])
  const isStreaming = ref(false)
  const error = ref<string | null>(null)

  const historyForRequest = (): AssistantHistoryMessage[] =>
    messages.value.slice(-6).map((m) => ({ role: m.role, content: m.content }))

  const sendMessage = async (text: string): Promise<void> => {
    error.value = null
    const history = historyForRequest()

    messages.value.push({ id: generateId(), role: 'user', content: text })
    // Usar reactive() garante que mutações no closure (token a token) disparem reatividade.
    // Sem reactive(), o Vue não faria proxy dessa referência e o componente não re-renderizaria durante streaming.
    const assistantMessage = reactive<AssistantMessage>({ id: generateId(), role: 'assistant', content: '' })
    messages.value.push(assistantMessage)

    isStreaming.value = true

    try {
      await streamChat(text, history, {
        onToken: (token) => {
          assistantMessage.content += token
        },
        onSources: (sources) => {
          assistantMessage.sources = sources
        },
        onDone: () => {
          isStreaming.value = false
        },
        onError: (message) => {
          assistantMessage.error = true
          error.value = message
          isStreaming.value = false
        },
      })
    } catch (err) {
      assistantMessage.error = true
      error.value = 'Falha inesperada ao conversar com o assistente.'
      isStreaming.value = false
    }
  }

  const clear = (): void => {
    messages.value = []
    error.value = null
  }

  return { messages, isStreaming, error, sendMessage, clear }
})
