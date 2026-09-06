import request from 'supertest';
import { app } from '../../src/app';
import { createUserWithPermissions } from '../helpers/fixtures';
import { cleanDatabase, disconnectTestDb } from '../helpers/db';
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
    // repassa o signal até answerQuestion, para poder cancelar o streaming
    // do Ollama se o cliente desconectar.
    const signalArg = mockedAnswerQuestion.mock.calls[0][3];
    expect(signalArg).toBeInstanceOf(AbortSignal);
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
});
