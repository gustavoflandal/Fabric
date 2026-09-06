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
function createMockRes(): Response {
  return {
    locals: {},
    writeHead: jest.fn(),
    write: jest.fn(),
    end: jest.fn(),
  } as unknown as Response;
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
