import { config } from '../config/env';

/**
 * Wrapper fino sobre a API HTTP nativa do Ollama (`/api/embeddings`,
 * `/api/chat`). Sem SDK — `fetch` nativo (Node 22).
 *
 * Fase 2: `chatStream` ganha suporte a tool calling, unificado com o `signal`
 * de cancelamento (correção de regressão pós-Fase 1) num único parâmetro de
 * opções. Comportamento real do Ollama (confirmado empiricamente, não é
 * suposição): quando o modelo decide chamar uma tool, a resposta chega em UMA
 * linha NDJSON com `message.tool_calls` e `done: false` — nenhum token de
 * texto acompanha essa rodada. `tool_calls[].function.arguments` já vem como
 * objeto parseado.
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ToolCall {
  id?: string;
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

export type ChatStreamEvent = { type: 'token'; text: string } | { type: 'tool_calls'; calls: ToolCall[] };

export interface ChatStreamOptions {
  tools?: ToolDefinition[];
  /**
   * Cancela o streaming quando o cliente HTTP desconecta — ver
   * `assistant.controller.ts`. Sem isso, com o modelo rodando CPU-only, o
   * backend continuaria consumindo a resposta do Ollama até o fim mesmo sem
   * ninguém para recebê-la.
   */
  signal?: AbortSignal;
}

export async function embed(text: string): Promise<number[]> {
  const res = await fetch(`${config.assistant.ollamaUrl}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.assistant.embedModel,
      prompt: text,
      options: { num_ctx: config.assistant.numCtx },
    }),
  });

  if (!res.ok) {
    throw new Error(`Ollama embeddings falhou: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { embedding: number[] };
  return data.embedding;
}

export async function* chatStream(messages: ChatMessage[], options: ChatStreamOptions = {}): AsyncGenerator<ChatStreamEvent> {
  const { tools, signal } = options;

  const res = await fetch(`${config.assistant.ollamaUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.assistant.chatModel,
      messages,
      stream: true,
      options: { num_ctx: config.assistant.numCtx },
      ...(tools ? { tools } : {}),
    }),
    signal,
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

      const parsed = JSON.parse(line) as {
        message?: { content: string; tool_calls?: ToolCall[] };
        done: boolean;
      };

      if (parsed.message?.tool_calls && parsed.message.tool_calls.length > 0) {
        yield { type: 'tool_calls', calls: parsed.message.tool_calls };
      } else if (parsed.message?.content) {
        yield { type: 'token', text: parsed.message.content };
      }

      if (parsed.done) {
        return;
      }
    }
  }
}
