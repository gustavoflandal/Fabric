export interface AssistantSource {
  arquivo: string
  trecho: string
}

export interface AssistantHistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AssistantMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: AssistantSource[]
  error?: boolean
}

export interface AssistantStreamHandlers {
  onToken: (text: string) => void
  onSources: (sources: AssistantSource[]) => void
  onDone: () => void
  onError: (message: string) => void
}
