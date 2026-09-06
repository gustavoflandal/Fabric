import { embed, chatStream, type ChatMessage } from '../../src/services/ollama-client.service';

function makeFakeBody(lines: string[]) {
  let i = 0;
  return {
    getReader: () => ({
      read: async () => {
        if (i >= lines.length) return { done: true, value: undefined };
        const chunk = new TextEncoder().encode(lines[i] + '\n');
        i += 1;
        return { done: false, value: chunk };
      },
    }),
  };
}

function makeFakeBodyRaw(chunks: string[]) {
  let i = 0;
  return {
    getReader: () => ({
      read: async () => {
        if (i >= chunks.length) return { done: true, value: undefined };
        const chunk = new TextEncoder().encode(chunks[i]);
        i += 1;
        return { done: false, value: chunk };
      },
    }),
  };
}

describe('ollama-client.service', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  describe('embed', () => {
    it('chama POST /api/embeddings com o modelo configurado e retorna o vetor', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ embedding: [0.1, 0.2, 0.3] }),
      });
      global.fetch = mockFetch as any;

      const result = await embed('texto de teste');

      expect(result).toEqual([0.1, 0.2, 0.3]);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/embeddings');
      const body = JSON.parse(options.body);
      expect(body.prompt).toBe('texto de teste');
      expect(body.model).toBe('bge-m3');
      expect(body.options).toBeDefined();
      expect(body.options.num_ctx).toBe(4096);
    });

    it('lança erro quando a resposta não é ok', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'erro interno',
      }) as any;

      await expect(embed('x')).rejects.toThrow(/Ollama embeddings falhou/);
    });
  });

  describe('chatStream', () => {
    it('emite cada fragmento de texto recebido via NDJSON e para no done', async () => {
      const lines = [
        JSON.stringify({ message: { role: 'assistant', content: 'Olá' }, done: false }),
        JSON.stringify({ message: { role: 'assistant', content: ', mundo' }, done: false }),
        JSON.stringify({ message: { role: 'assistant', content: '' }, done: true }),
      ];
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        body: makeFakeBody(lines),
      });
      global.fetch = mockFetch as any;

      const messages: ChatMessage[] = [{ role: 'user', content: 'oi' }];
      const collected: string[] = [];
      for await (const token of chatStream(messages)) {
        collected.push(token);
      }

      expect(collected).toEqual(['Olá', ', mundo']);

      // Verify request details
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/chat');
      const body = JSON.parse(options.body);
      expect(body.model).toBe('qwen2.5:7b');
      expect(body.stream).toBe(true);
      expect(body.options).toBeDefined();
      expect(body.options.num_ctx).toBe(4096);
    });

    it('lança erro quando a resposta não é ok', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => 'indisponível',
        body: null,
      }) as any;

      const iterate = async () => {
        for await (const _ of chatStream([{ role: 'user', content: 'oi' }])) {
          // no-op
        }
      };

      await expect(iterate()).rejects.toThrow(/Ollama chat falhou/);
    });

    it('maneja múltiplas linhas NDJSON chegando no mesmo chunk', async () => {
      // Two complete NDJSON lines arriving together in one read() call
      const chunk =
        JSON.stringify({ message: { role: 'assistant', content: 'A' }, done: false })
        + '\n'
        + JSON.stringify({ message: { role: 'assistant', content: 'B' }, done: false })
        + '\n'
        + JSON.stringify({ message: { role: 'assistant', content: '' }, done: true })
        + '\n';
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        body: makeFakeBodyRaw([chunk]),
      }) as any;

      const messages: ChatMessage[] = [{ role: 'user', content: 'oi' }];
      const collected: string[] = [];
      for await (const token of chatStream(messages)) {
        collected.push(token);
      }

      expect(collected).toEqual(['A', 'B']);
    });

    it('maneja uma linha NDJSON dividida em múltiplos chunks', async () => {
      // One JSON line split across two read() calls (without automatic newline insertion)
      const line1 = '{"message":{"role":"assistant","content":"X"},"done":false}';
      const line2 = '{"message":{"role":"assistant","content":""},"done":true}';
      const chunks = [
        line1.slice(0, 30), // First part of line1 (ends mid-line, no newline)
        line1.slice(30) + '\n' + line2 + '\n', // Rest of line1 + newline + complete line2 + newline
      ];
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        body: makeFakeBodyRaw(chunks),
      }) as any;

      const messages: ChatMessage[] = [{ role: 'user', content: 'oi' }];
      const collected: string[] = [];
      for await (const token of chatStream(messages)) {
        collected.push(token);
      }

      expect(collected).toEqual(['X']);
    });

    it('repassa o AbortSignal recebido para o fetch', async () => {
      const lines = [JSON.stringify({ message: { role: 'assistant', content: '' }, done: true })];
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        body: makeFakeBody(lines),
      });
      global.fetch = mockFetch as any;

      const abortController = new AbortController();
      const messages: ChatMessage[] = [{ role: 'user', content: 'oi' }];
      for await (const _ of chatStream(messages, abortController.signal)) {
        // no-op
      }

      const [, options] = mockFetch.mock.calls[0];
      expect(options.signal).toBe(abortController.signal);
    });
  });
});
