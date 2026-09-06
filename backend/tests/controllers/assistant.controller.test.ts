import type { Request, Response } from 'express';
import { chat } from '../../src/controllers/assistant.controller';
import * as assistantService from '../../src/services/assistant.service';

jest.mock('../../src/services/assistant.service');

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

function createMockReq(body: unknown): Request {
  return {
    body,
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

    const req = createMockReq({ message: 'qual o procedimento?' });
    const res = createMockRes();

    await chat(req, res, jest.fn());

    expect(res.locals.auditResponseBody).toEqual({
      resposta: 'Olá, mundo',
      fontes: [{ arquivo: 'x.pdf', trecho: 'trecho relevante' }],
    });
  });

  it('preenche res.locals.auditResponseBody com o que foi gerado até então, mesmo no caminho de erro (catch)', async () => {
    mockedAnswerQuestion.mockImplementation(async (_msg, _history, events) => {
      events.onToken('Resposta parcial antes da falha');
      throw new Error('Ollama fora do ar');
    });

    const req = createMockReq({ message: 'qual o procedimento?' });
    const res = createMockRes();

    await chat(req, res, jest.fn());

    expect(res.locals.auditResponseBody).toEqual({
      resposta: 'Resposta parcial antes da falha',
      fontes: [],
    });
  });

  it('não citar fontes numa recusa também se reflete na auditoria: fontes fica vazio quando onSources nunca é chamado', async () => {
    mockedAnswerQuestion.mockImplementation(async (_msg, _history, events) => {
      events.onToken('Não encontrei essa informação nos manuais do sistema.');
      events.onDone();
    });

    const req = createMockReq({ message: 'pergunta sem resposta nos manuais' });
    const res = createMockRes();

    await chat(req, res, jest.fn());

    expect(res.locals.auditResponseBody).toEqual({
      resposta: 'Não encontrei essa informação nos manuais do sistema.',
      fontes: [],
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

    mockedAnswerQuestion.mockImplementation(async (_msg, _history, events, signal) => {
      signalRecebido = signal;
      events.onToken('Olá');
      events.onDone(); // chama res.end() -> res.writableEnded vira true
    });

    const req = createMockReq({ message: 'qual o procedimento?' });
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

    mockedAnswerQuestion.mockImplementation(async (_msg, _history, events, signal) => {
      signalRecebido = signal;
      events.onToken('Resposta parcial');
      // Cliente desconecta no meio do streaming, antes de onDone/res.end().
      res.__triggerClose();
      // não chama onDone — a promise nunca é resolvida por um "fim" normal
    });

    const req = createMockReq({ message: 'qual o procedimento?' });
    await chat(req, res, jest.fn());

    expect(res.end).not.toHaveBeenCalled();
    expect(signalRecebido?.aborted).toBe(true);
  });
});
