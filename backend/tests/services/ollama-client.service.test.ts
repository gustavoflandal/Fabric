// backend/tests/services/ollama-client.service.test.ts
import { embed, chatStream, type ChatMessage, type ToolDefinition } from '../../src/services/ollama-client.service';

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

function makeFakeBodyRaw(lines: string[]) {
  let i = 0;
  return {
    getReader: () => ({
      read: async () => {
        if (i >= lines.length) return { done: true, value: undefined };
        const chunk = new TextEncoder().encode(lines[i]);
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
    it('chama POST /api/embeddings com o modelo configurado, num_ctx, e retorna o vetor', async () => {
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
    it('emite eventos {type:"token"} para cada fragmento de texto e para no done', async () => {
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
      const collected: any[] = [];
      for await (const event of chatStream(messages)) {
        collected.push(event);
      }

      expect(collected).toEqual([
        { type: 'token', text: 'Olá' },
        { type: 'token', text: ', mundo' },
      ]);
    });

    it('emite um único evento {type:"tool_calls"} quando o modelo pede uma tool, sem nenhum token de texto', async () => {
      const lines = [
        JSON.stringify({
          message: {
            role: 'assistant',
            content: '',
            tool_calls: [{ id: 'call_1', function: { name: 'getSaldoProduto', arguments: { codigoProduto: 'PROD-001' } } }],
          },
          done: false,
        }),
        JSON.stringify({ message: { role: 'assistant', content: '' }, done: true }),
      ];
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        body: makeFakeBody(lines),
      }) as any;

      const messages: ChatMessage[] = [{ role: 'user', content: 'qual o saldo do PROD-001?' }];
      const collected: any[] = [];
      for await (const event of chatStream(messages)) {
        collected.push(event);
      }

      expect(collected).toEqual([
        {
          type: 'tool_calls',
          calls: [{ id: 'call_1', function: { name: 'getSaldoProduto', arguments: { codigoProduto: 'PROD-001' } } }],
        },
      ]);
    });

    it('envia a lista de tools no corpo da requisição quando fornecida via options.tools', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        body: makeFakeBody([JSON.stringify({ message: { content: 'ok' }, done: true })]),
      });
      global.fetch = mockFetch as any;

      const tools: ToolDefinition[] = [
        {
          type: 'function',
          function: { name: 'getSaldoProduto', description: 'desc', parameters: { type: 'object', properties: {} } },
        },
      ];

      const collected: any[] = [];
      for await (const event of chatStream([{ role: 'user', content: 'oi' }], { tools })) {
        collected.push(event);
      }

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.tools).toEqual(tools);
    });

    it('não inclui "tools" no corpo quando não fornecida em options', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        body: makeFakeBody([JSON.stringify({ message: { content: 'ok' }, done: true })]),
      });
      global.fetch = mockFetch as any;

      const collected: any[] = [];
      for await (const event of chatStream([{ role: 'user', content: 'oi' }])) {
        collected.push(event);
      }

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.tools).toBeUndefined();
    });

    it('repassa options.signal para o fetch (cobertura preservada da correção de cancelamento de stream)', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        body: makeFakeBody([JSON.stringify({ message: { content: 'ok' }, done: true })]),
      });
      global.fetch = mockFetch as any;

      const controller = new AbortController();
      const collected: any[] = [];
      for await (const event of chatStream([{ role: 'user', content: 'oi' }], { signal: controller.signal })) {
        collected.push(event);
      }

      expect(mockFetch.mock.calls[0][1].signal).toBe(controller.signal);
    });

    it('lida com múltiplas linhas de token em um único chunk de rede', async () => {
      const chunk =
        JSON.stringify({ message: { content: 'A' }, done: false }) +
        '\n' +
        JSON.stringify({ message: { content: 'B' }, done: false }) +
        '\n' +
        JSON.stringify({ message: { content: '' }, done: true }) +
        '\n';
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        body: makeFakeBodyRaw([chunk]),
      }) as any;

      const collected: any[] = [];
      for await (const event of chatStream([{ role: 'user', content: 'oi' }])) {
        collected.push(event);
      }

      expect(collected).toEqual([
        { type: 'token', text: 'A' },
        { type: 'token', text: 'B' },
      ]);
    });

    it('lida com uma linha de token dividida entre dois chunks de rede', async () => {
      const line1 = JSON.stringify({ message: { role: 'assistant', content: 'X' }, done: false });
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        body: makeFakeBodyRaw([line1.slice(0, 30), line1.slice(30) + '\n' + JSON.stringify({ message: { content: '' }, done: true }) + '\n']),
      }) as any;

      const collected: any[] = [];
      for await (const event of chatStream([{ role: 'user', content: 'oi' }])) {
        collected.push(event);
      }

      expect(collected).toEqual([{ type: 'token', text: 'X' }]);
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
