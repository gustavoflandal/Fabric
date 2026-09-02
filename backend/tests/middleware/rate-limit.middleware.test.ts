import { Request, Response } from 'express';
import { rateLimit } from '../../src/middleware/rate-limit.middleware';

/**
 * Regressão do store compartilhado entre limitadores.
 *
 * Antes desta correção, `store` era um objeto module-level ÚNICO: toda
 * instância criada por `rateLimit()` escrevia no mesmo mapa. Como
 * `generalLimiter` (global, em app.ts) e `authLimiter` (por cima dele, em
 * /auth/login e /auth/refresh) usam o mesmo `keyGenerator` padrão (`req.ip`),
 * os dois disputavam literalmente a MESMA chave — requisições comuns
 * consumiam a cota de tentativas de login do IP, e vice-versa.
 *
 * Estes testes exercitam o middleware direto (sem subir o Express) porque o
 * comportamento em questão é do contador, não do roteamento.
 */

const makeReq = (ip = '203.0.113.10') =>
  ({ ip, socket: { remoteAddress: ip } } as unknown as Request);

interface FakeRes {
  statusCode: number;
  __status: number;
  __headers: Record<string, string>;
  __body: unknown;
  __finishHandlers: (() => void)[];
  setHeader(name: string, value: string): FakeRes;
  status(code: number): FakeRes;
  json(body: unknown): FakeRes;
  on(event: string, handler: () => void): FakeRes;
}

const makeRes = (): FakeRes => {
  const res: FakeRes = {
    statusCode: 200,
    __status: 200,
    __headers: {},
    __body: undefined,
    __finishHandlers: [],
    setHeader(name, value) {
      res.__headers[name] = value;
      return res;
    },
    status(code) {
      res.__status = code;
      res.statusCode = code;
      return res;
    },
    json(body) {
      res.__body = body;
      return res;
    },
    on(event, handler) {
      if (event === 'finish') res.__finishHandlers.push(handler);
      return res;
    },
  };

  return res;
};

type Middleware = ReturnType<typeof rateLimit>;

/** Executa o middleware uma vez e diz se a requisição passou (`next()`). */
const hit = (middleware: Middleware, req: Request) => {
  const res = makeRes();
  let passed = false;
  middleware(req, res as unknown as Response, () => {
    passed = true;
  });
  return { passed, status: passed ? 200 : res.__status, headers: res.__headers };
};

describe('rateLimit', () => {
  it('bloqueia com 429 a partir da requisição que ultrapassa o máximo', () => {
    const limiter = rateLimit({ windowMs: 60_000, max: 2 });
    const req = makeReq();

    expect(hit(limiter, req).passed).toBe(true); // 1
    expect(hit(limiter, req).passed).toBe(true); // 2 = max, ainda passa

    const blocked = hit(limiter, req); // 3 > max
    expect(blocked.passed).toBe(false);
    expect(blocked.status).toBe(429);
  });

  it('mantém contadores independentes por IP dentro do mesmo limitador', () => {
    const limiter = rateLimit({ windowMs: 60_000, max: 2 });

    expect(hit(limiter, makeReq('198.51.100.1')).passed).toBe(true);
    expect(hit(limiter, makeReq('198.51.100.1')).passed).toBe(true);
    expect(hit(limiter, makeReq('198.51.100.1')).passed).toBe(false);

    // Outro IP começa a própria janela do zero.
    expect(hit(limiter, makeReq('198.51.100.2')).passed).toBe(true);
  });

  it('isola o store por instância: estourar um limitador não afeta o outro para o MESMO IP', () => {
    // Mesma forma dos limitadores reais: um geral folgado aplicado a tudo, e um
    // de autenticação restrito aplicado por cima em algumas rotas. Ambos com o
    // keyGenerator padrão (req.ip), que é a condição do bug original.
    const general = rateLimit({ windowMs: 15 * 60_000, max: 100 });
    const auth = rateLimit({ windowMs: 15 * 60_000, max: 3 });

    const req = makeReq('192.0.2.77');

    // Tráfego comum: 50 requisições passando pelo limitador geral.
    for (let i = 0; i < 50; i += 1) {
      expect(hit(general, req).passed).toBe(true);
    }

    // O limitador de auth não viu nenhuma dessas 50 — o contador dele está
    // zerado e as 3 tentativas de login continuam disponíveis.
    expect(hit(auth, req).passed).toBe(true);
    expect(hit(auth, req).passed).toBe(true);
    expect(hit(auth, req).passed).toBe(true);
    expect(hit(auth, req).passed).toBe(false); // 4ª estoura o limite de auth

    // E estourar o de auth não derruba o geral: ele viu 50 de 100.
    expect(hit(general, req).passed).toBe(true);
  });

  it('não vaza contagem entre instâncias criadas com as mesmas opções', () => {
    const options = { windowMs: 60_000, max: 2 };
    const first = rateLimit(options);
    const req = makeReq('198.51.100.9');

    hit(first, req);
    hit(first, req);
    expect(hit(first, req).passed).toBe(false);

    // Instância nova = store novo, mesmo com opções e IP idênticos.
    const second = rateLimit(options);
    expect(hit(second, req).passed).toBe(true);
  });

  it('respeita um keyGenerator customizado sem tocar no store dos outros limitadores', () => {
    const byUser = rateLimit({
      windowMs: 60_000,
      max: 2,
      keyGenerator: (req: Request) => (req as Request & { userId?: string }).userId ?? 'anon',
    });

    const reqA = Object.assign(makeReq('203.0.113.1'), { userId: 'user-a' }) as Request;
    const reqB = Object.assign(makeReq('203.0.113.1'), { userId: 'user-b' }) as Request;

    expect(hit(byUser, reqA).passed).toBe(true);
    expect(hit(byUser, reqA).passed).toBe(true);
    expect(hit(byUser, reqA).passed).toBe(false);

    // Mesmo IP, usuário diferente: chave diferente, contador próprio.
    expect(hit(byUser, reqB).passed).toBe(true);
  });

  it('publica os headers X-RateLimit-* com o restante da janela', () => {
    const limiter = rateLimit({ windowMs: 60_000, max: 5 });
    const req = makeReq('203.0.113.55');

    hit(limiter, req); // a primeira abre a janela e não emite headers
    const second = hit(limiter, req);

    expect(second.headers['X-RateLimit-Limit']).toBe('5');
    expect(second.headers['X-RateLimit-Remaining']).toBe('3');
  });
});
