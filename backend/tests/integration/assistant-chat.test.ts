import request from 'supertest';
import { app } from '../../src/app';
import { createUserWithPermissions } from '../helpers/fixtures';
import { cleanDatabase, disconnectTestDb, testPrisma } from '../helpers/db';
import { clearSettingCache } from '../../src/services/system-setting.service';
import * as assistantService from '../../src/services/assistant.service';

jest.mock('../../src/services/assistant.service');
const mockedAnswerQuestion = assistantService.answerQuestion as jest.Mock;

const loginWith = async (permissions: { resource: string; action: string }[]) => {
  const user = await createUserWithPermissions(permissions);
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: 'Test@Password123' });
  return res.body.data.accessToken as string;
};

describe('Integração: POST /api/v1/assistant/chat', () => {
  afterEach(async () => {
    clearSettingCache();
    await cleanDatabase();
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('nega 403 para quem não tem assistente_ia:usar', async () => {
    const token = await loginWith([{ resource: 'outra_coisa', action: 'usar' }]);

    const res = await request(app)
      .post('/api/v1/assistant/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'oi' });

    expect(res.status).toBe(403);
  });

  it('nega 401 sem token', async () => {
    const res = await request(app).post('/api/v1/assistant/chat').send({ message: 'oi' });
    expect(res.status).toBe(401);
  });

  it('rejeita mensagem vazia com 400', async () => {
    const token = await loginWith([{ resource: 'assistente_ia', action: 'usar' }]);

    const res = await request(app)
      .post('/api/v1/assistant/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: '' });

    expect(res.status).toBe(400);
  });

  it('rejeita mensagem acima de 1000 caracteres com 400', async () => {
    const token = await loginWith([{ resource: 'assistente_ia', action: 'usar' }]);

    const res = await request(app)
      .post('/api/v1/assistant/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'a'.repeat(1001) });

    expect(res.status).toBe(400);
  });

  it('transmite os eventos SSE de token, fontes e fim', async () => {
    const token = await loginWith([{ resource: 'assistente_ia', action: 'usar' }]);

    mockedAnswerQuestion.mockImplementation(async (_msg, _history, events) => {
      events.onToken('Olá');
      events.onToken(', mundo');
      events.onSources([{ arquivo: 'x.pdf', trecho: 'trecho' }]);
      events.onDone();
    });

    const res = await request(app)
      .post('/api/v1/assistant/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'qual o procedimento?' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.text).toContain('event: token');
    expect(res.text).toContain('"text":"Olá"');
    expect(res.text).toContain('event: fontes');
    expect(res.text).toContain('event: fim');

    // achado 4 da revisão final: o controller cria um AbortController e
    // repassa o signal (dentro do objeto de opções da Fase 2) até
    // answerQuestion, para poder cancelar o streaming do Ollama se o
    // cliente desconectar.
    const optionsArg = mockedAnswerQuestion.mock.calls[0][3];
    expect(optionsArg.signal).toBeInstanceOf(AbortSignal);
  });

  it('achado 5 da revisão final: grava a resposta do assistente no AuditLog via res.locals.auditResponseBody', async () => {
    // .env.test define AUDIT_LOG_MODE=none (evita ruído nos demais testes de
    // integração) — precisa de um audit.mode explícito no banco para este
    // teste, igual ao padrão usado em tests/integration/audit-middleware.test.ts.
    await testPrisma.systemSetting.create({
      data: { key: 'audit.mode', value: 'write_only', type: 'STRING', category: 'auditoria', label: 'Modo de auditoria' },
    });
    clearSettingCache();

    const token = await loginWith([{ resource: 'assistente_ia', action: 'usar' }]);

    mockedAnswerQuestion.mockImplementation(async (_msg, _history, events) => {
      events.onToken('Olá');
      events.onToken(', mundo');
      events.onSources([{ arquivo: 'x.pdf', trecho: 'trecho' }]);
      events.onDone();
    });

    await request(app)
      .post('/api/v1/assistant/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'qual o procedimento?' });

    // O log é gravado em res.on('finish', async () => {...}), depois da
    // resposta HTTP já ter sido enviada — poll curto em vez de checar uma
    // vez só.
    const deadline = Date.now() + 1000;
    let logs = await testPrisma.auditLog.findMany({
      where: { endpoint: '/api/v1/assistant/chat', method: 'POST' },
    });
    while (logs.length === 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      logs = await testPrisma.auditLog.findMany({
        where: { endpoint: '/api/v1/assistant/chat', method: 'POST' },
      });
    }

    expect(logs.length).toBeGreaterThanOrEqual(1);
    const responseBody = logs[0].responseBody as unknown as { resposta: string; fontes: unknown[] } | null;
    expect(responseBody).not.toBeNull();
    expect(responseBody?.resposta).toBe('Olá, mundo');
    expect(responseBody?.fontes).toEqual([{ arquivo: 'x.pdf', trecho: 'trecho' }]);
  });

  it('emite evento erro (sem quebrar a conexão) quando answerQuestion lança exceção', async () => {
    const token = await loginWith([{ resource: 'assistente_ia', action: 'usar' }]);
    mockedAnswerQuestion.mockRejectedValue(new Error('Ollama fora do ar'));

    const res = await request(app)
      .post('/api/v1/assistant/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'qual o procedimento?' });

    expect(res.status).toBe(200);
    expect(res.text).toContain('event: erro');
  });

  it('usuário com stock:read recebe o evento consulta quando answerQuestion o emite', async () => {
    const token = await loginWith([
      { resource: 'assistente_ia', action: 'usar' },
      { resource: 'stock', action: 'read' },
    ]);

    mockedAnswerQuestion.mockImplementation(async (_msg, _history, events) => {
      events.onToken('resposta');
      events.onConsulta({ funcao: 'getSaldoProduto', parametros: { codigoProduto: 'X' }, linhas: 1 });
      events.onDone();
    });

    const res = await request(app)
      .post('/api/v1/assistant/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'qual o saldo?' });

    expect(res.status).toBe(200);
    expect(res.text).toContain('event: consulta');

    const optionsArg = mockedAnswerQuestion.mock.calls[0][3];
    expect(optionsArg).toEqual(expect.objectContaining({ hasStockAccess: true }));
  });
});
