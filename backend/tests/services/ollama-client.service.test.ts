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
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        body: makeFakeBody(lines),
      }) as any;

      const messages: ChatMessage[] = [{ role: 'user', content: 'oi' }];
      const collected: string[] = [];
      for await (const token of chatStream(messages)) {
        collected.push(token);
      }

      expect(collected).toEqual(['Olá', ', mundo']);
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
  });
});
