import { config } from '../config/env';

/**
 * Wrapper fino sobre a API HTTP nativa do Ollama (`/api/embeddings`,
 * `/api/chat`). Sem SDK — `fetch` nativo (Node 22), mesmo critério de
 * "sem framework de orquestração" registrado na spec (seção "Approach A").
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function embed(text: string): Promise<number[]> {
  const res = await fetch(`${config.assistant.ollamaUrl}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: config.assistant.embedModel, prompt: text }),
  });

  if (!res.ok) {
    throw new Error(`Ollama embeddings falhou: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { embedding: number[] };
  return data.embedding;
}

export async function* chatStream(messages: ChatMessage[]): AsyncGenerator<string> {
  const res = await fetch(`${config.assistant.ollamaUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.assistant.chatModel,
      messages,
      stream: true,
      options: { num_ctx: config.assistant.numCtx },
    }),
  });

  if (!res.ok || !res.body) {
    throw new Error(`Ollama chat falhou: ${res.status} ${await res.text()}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex;
    while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (!line) continue;

      const parsed = JSON.parse(line) as { message?: { content: string }; done: boolean };
      if (parsed.message?.content) {
        yield parsed.message.content;
      }
      if (parsed.done) {
        return;
      }
    }
  }
}
