import type { Request, Response } from 'express';
import { chat } from '../../src/controllers/assistant.controller';
import * as assistantService from '../../src/services/assistant.service';
import { getUserWithPermissions } from '../../src/middleware/permission.middleware';

jest.mock('../../src/services/assistant.service');
jest.mock('../../src/middleware/permission.middleware', () => ({
  ...jest.requireActual('../../src/middleware/permission.middleware'),
  getUserWithPermissions: jest.fn(),
}));

const mockedAnswerQuestion = assistantService.answerQuestion as jest.Mock;

/**
 * Achado 5 da revisão final: o endpoint SSE do assistente usa `res.write`,
 * nunca `res.json` — o `audit.middleware.ts` global intercepta `res.json`
 * para capturar a resposta, então nessa rota `responseBody` sempre ficava
 * `null`. A correção faz o controller acumular a resposta e preencher
 * `res.locals.auditResponseBody` (lido pelo middleware como alternativa)
 * antes de `res.end()`, tanto no caminho normal quanto no de erro.
 *
 * Testado aqui isoladamente (sem supertest) porque `res.locals` não é
 * observável de fora de uma requisição HTTP real.
 */
/**
 * Captura o callback passado a `res.on('close', callback)` para que os
 * testes possam disparar manualmente uma desconexão simulada — e expõe
 * `writableEnded` como uma flag real, atualizada por `end()`, para o guard
 * `if (!res.writableEnded)` do controller se comportar como no Express real.
 */
function createMockRes(): Response & { __triggerClose: () => void } {
  const listeners: Record<string, () => void> = {};
  const res: any = {
    locals: {},
    writableEnded: false,
    writeHead: jest.fn(),
    write: jest.fn(),
    end: jest.fn(() => {
      res.writableEnded = true;
    }),
    on: jest.fn((event: string, cb: () => void) => {
      listeners[event] = cb;
    }),
    __triggerClose: () => listeners['close']?.(),
  };
  return res as Response & { __triggerClose: () => void };
}

function createMockReq(opts: { userId?: string; body: unknown }): Request {
  return {
    userId: opts.userId ?? 'u1',
    body: opts.body,
    on: jest.fn(),
  } as unknown as Request;
}

describe('assistant.controller.chat — auditoria da resposta (res.locals.auditResponseBody)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('preenche res.locals.auditResponseBody com a resposta acumulada e as fontes no caminho normal (onDone)', async () => {
    mockedAnswerQuestion.mockImplementation(async (_msg, _history, events) => {
      events.onToken('Olá');
      events.onToken(', mundo');
      events.onSources([{ arquivo: 'x.pdf', trecho: 'trecho relevante' }]);
      events.onDone();
    });

    const req = createMockReq({ body: { message: 'qual o procedimento?' } });
    const res = createMockRes();

    await chat(req, res, jest.fn());

    expect(res.locals.auditResponseBody).toEqual({
      resposta: 'Olá, mundo',
      fontes: [{ arquivo: 'x.pdf', trecho: 'trecho relevante' }],
      consultas: [],
    });
  });

  it('preenche res.locals.auditResponseBody com o que foi gerado até então, mesmo no caminho de erro (catch)', async () => {
    mockedAnswerQuestion.mockImplementation(async (_msg, _history, events) => {
      events.onToken('Resposta parcial antes da falha');
      throw new Error('Ollama fora do ar');
    });

    const req = createMockReq({ body: { message: 'qual o procedimento?' } });
    const res = createMockRes();

    await chat(req, res, jest.fn());

    expect(res.locals.auditResponseBody).toEqual({
      resposta: 'Resposta parcial antes da falha',
      fontes: [],
      consultas: [],
    });
  });

  it('não citar fontes numa recusa também se reflete na auditoria: fontes fica vazio quando onSources nunca é chamado', async () => {
    mockedAnswerQuestion.mockImplementation(async (_msg, _history, events) => {
      events.onToken('Não encontrei essa informação nos manuais do sistema.');
      events.onDone();
    });

    const req = createMockReq({ body: { message: 'pergunta sem resposta nos manuais' } });
    const res = createMockRes();

    await chat(req, res, jest.fn());

    expect(res.locals.auditResponseBody).toEqual({
      resposta: 'Não encontrei essa informação nos manuais do sistema.',
      fontes: [],
      consultas: [],
    });
  });
});

/**
 * Regressão crítica encontrada numa revisão de confirmação: o cancelamento
 * do stream (achado 4) originalmente escutava `req.on('close', ...)`.
 * `req` (IncomingMessage) emite 'close' assim que a MENSAGEM DE REQUISIÇÃO
 * termina de ser lida — no Node 22 + Express isso acontece quase
 * imediatamente após `express.json()` consumir o body, bem antes de
 * qualquer desconexão real. Isso abortava o AbortSignal ~1ms após o handler
 * começar, derrubando toda pergunta contra um Ollama real com `AbortError`.
 * A correção escuta em `res.on('close', ...)` (evento da CONEXÃO/socket) com
 * um guard `!res.writableEnded` para não abortar no caminho feliz.
 *
 * Os testes de auditoria acima nunca invocavam o callback registrado em
 * `on('close', ...)` (o mock antigo de `on` era só `jest.fn()`), por isso
 * não pegaram a regressão. Estes testes capturam o callback de verdade e o
 * disparam manualmente, nos dois cenários.
 */
describe('assistant.controller.chat — cancelamento do stream via res.on(close)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('NÃO aborta o signal quando a conexão fecha DEPOIS de res.end() já ter sido chamado (caminho feliz)', async () => {
    const res = createMockRes();
    let signalRecebido: AbortSignal | undefined;

    mockedAnswerQuestion.mockImplementation(async (_msg, _history, events, options) => {
      signalRecebido = options.signal;
      events.onToken('Olá');
      events.onDone(); // chama res.end() -> res.writableEnded vira true
    });

    const req = createMockReq({ body: { message: 'qual o procedimento?' } });
    await chat(req, res, jest.fn());

    expect(res.end).toHaveBeenCalled();

    // Simula o socket fechando normalmente, como acontece logo depois de
    // res.end() no caminho feliz.
    res.__triggerClose();

    expect(signalRecebido?.aborted).toBe(false);
  });

  it('ABORTA o signal quando a conexão fecha ANTES de res.end() ser chamado (desconexão real do cliente)', async () => {
    const res = createMockRes();
    let signalRecebido: AbortSignal | undefined;

    mockedAnswerQuestion.mockImplementation(async (_msg, _history, events, options) => {
      signalRecebido = options.signal;
      events.onToken('Resposta parcial');
      // Cliente desconecta no meio do streaming, antes de onDone/res.end().
      res.__triggerClose();
      // não chama onDone — a promise nunca é resolvida por um "fim" normal
    });

    const req = createMockReq({ body: { message: 'qual o procedimento?' } });
    await chat(req, res, jest.fn());

    expect(res.end).not.toHaveBeenCalled();
    expect(signalRecebido?.aborted).toBe(true);
  });
});

describe('assistant.controller.chat — Fase 2 (stock:read)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('emite evento "consulta" quando answerQuestion chama onConsulta', async () => {
    (getUserWithPermissions as jest.Mock).mockResolvedValue({
      roles: [{ role: { permissions: [{ permission: { resource: 'stock', action: 'read' } }] } }],
    });

    mockedAnswerQuestion.mockImplementation(async (_msg, _history, events) => {
      events.onToken('O produto tem 42 unidades.');
      events.onConsulta({ funcao: 'getSaldoProduto', parametros: { codigoProduto: 'PROD-001' }, linhas: 1 });
      events.onDone();
    });

    const req = createMockReq({ userId: 'u1', body: { message: 'saldo?' } });
    const res = createMockRes();

    await chat(req, res, jest.fn());

    expect(res.write).toHaveBeenCalledWith(expect.stringContaining('event: consulta'));
    expect(res.write).toHaveBeenCalledWith(
      expect.stringContaining(JSON.stringify({ funcao: 'getSaldoProduto', parametros: { codigoProduto: 'PROD-001' }, linhas: 1 }))
    );
  });

  it('passa hasStockAccess=true para answerQuestion quando o usuário tem stock:read', async () => {
    (getUserWithPermissions as jest.Mock).mockResolvedValue({
      roles: [{ role: { permissions: [{ permission: { resource: 'stock', action: 'read' } }] } }],
    });
    mockedAnswerQuestion.mockImplementation(async (_msg, _history, events) => events.onDone());

    const req = createMockReq({ userId: 'u1', body: { message: 'oi' } });
    const res = createMockRes();

    await chat(req, res, jest.fn());

    const options = mockedAnswerQuestion.mock.calls[0][3];
    // objectContaining, não toEqual: o objeto real também carrega `signal`
    // (o AbortSignal do controller) — este teste só verifica hasStockAccess.
    expect(options).toEqual(expect.objectContaining({ hasStockAccess: true }));
  });

  it('passa hasStockAccess=false quando o usuário NÃO tem stock:read', async () => {
    (getUserWithPermissions as jest.Mock).mockResolvedValue({
      roles: [{ role: { permissions: [{ permission: { resource: 'outra_coisa', action: 'ler' } }] } }],
    });
    mockedAnswerQuestion.mockImplementation(async (_msg, _history, events) => events.onDone());

    const req = createMockReq({ userId: 'u1', body: { message: 'oi' } });
    const res = createMockRes();

    await chat(req, res, jest.fn());

    const options = mockedAnswerQuestion.mock.calls[0][3];
    expect(options).toEqual(expect.objectContaining({ hasStockAccess: false }));
  });

  it('emite evento "erro" (sem derrubar o processo) quando a checagem de stock:read falha', async () => {
    // getUserWithPermissions faz uma query real no Prisma; se ela falhar
    // (timeout de conexão, erro transitório do banco, etc.), a checagem
    // precisa cair no mesmo catch que já trata falhas de answerQuestion —
    // caso contrário a rejeição escaparia sem tratamento (Express 4 sem
    // express-async-errors não encaminha rejeições de handler async para o
    // errorHandler), o que no Node deriva numa unhandled rejection capaz de
    // derrubar o processo inteiro, não só esta requisição.
    (getUserWithPermissions as jest.Mock).mockRejectedValue(new Error('falha de conexão'));

    const req = createMockReq({ userId: 'u1', body: { message: 'saldo?' } });
    const res = createMockRes();

    await chat(req, res, jest.fn());

    expect(res.write).toHaveBeenCalledWith(expect.stringContaining('event: erro'));
    expect(res.end).toHaveBeenCalled();
    expect(mockedAnswerQuestion).not.toHaveBeenCalled();
  });
});
