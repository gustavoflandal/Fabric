import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../../src/app';
import { cleanDatabase, disconnectTestDb, testPrisma } from '../helpers/db';

/**
 * `GET /api/v1/help` — conteúdo em Markdown do manual do usuário, servido do
 * mesmo arquivo (`docs/operacao/GUIA_USUARIO.md`) que o script de indexação
 * embute no ChromaDB. Sem requireModule (cross-módulo) nem requirePermission
 * específica — qualquer usuário autenticado acessa, mesmo sem nenhuma role.
 */

describe('GET /api/v1/help', () => {
  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('rejeita sem token', async () => {
    const res = await request(app).get('/api/v1/help');
    expect(res.status).toBe(401);
  });

  it('retorna o conteúdo do manual para qualquer usuário autenticado, sem exigir nenhuma role', async () => {
    const password = await bcrypt.hash('Test@Password123', 4);
    const user = await testPrisma.user.create({
      data: { email: 'sem-role-help@example.com', name: 'Sem Role', password },
    });
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'Test@Password123' });
    const token = login.body.data.accessToken as string;

    const res = await request(app).get('/api/v1/help').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(typeof res.body.data.content).toBe('string');
    expect(res.body.data.content.length).toBeGreaterThan(0);
    expect(res.body.data.content).toContain('Guia do Usuário');
    expect(res.body.data.updatedAt).toBeDefined();
  });
});
