export interface AssistantSource {
  arquivo: string
  trecho: string
}

export interface AssistantHistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ConsultaInfo {
  funcao: string
  parametros: Record<string, unknown>
  linhas: number
}

export interface AssistantMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: AssistantSource[]
  consultas?: ConsultaInfo[]
  error?: boolean
}

export interface AssistantStreamHandlers {
  onToken: (text: string) => void
  onSources: (sources: AssistantSource[]) => void
  onConsulta: (info: ConsultaInfo) => void
  onDone: () => void
  onError: (message: string) => void
}
