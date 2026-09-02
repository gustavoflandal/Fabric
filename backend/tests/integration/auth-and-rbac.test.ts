import request from 'supertest';
import { app } from '../../src/app';
import { cleanDatabase, disconnectTestDb } from '../helpers/db';
import { createUserWithPermissions } from '../helpers/fixtures';

// Fase 3 do cronograma, item 3.5: testes de integração HTTP para as rotas
// mais críticas de segurança - login e RBAC (Fase 2 do cronograma). Diferente
// dos testes de service (que chamam a lógica direto), estes passam pelo
// Express de verdade: middlewares de auth/permissão, validação, serialização
// JSON. `app` (src/app.ts) nunca chama `.listen()` - supertest sobe um
// servidor efêmero em memória por trás dos panos, sem ocupar porta nenhuma.

describe('Integração: auth e RBAC (Fase 3, item 3.5)', () => {
  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  describe('POST /api/v1/auth/login', () => {
    it('retorna 200 e um par de tokens com credenciais corretas', async () => {
      const user = await createUserWithPermissions([]);

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: 'Test@Password123' });

      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toEqual(expect.any(String));
      expect(res.body.data.refreshToken).toEqual(expect.any(String));
    });

    it('retorna 401 com senha errada', async () => {
      const user = await createUserWithPermissions([]);

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: 'senha-errada-qualquer' });

      expect(res.status).toBe(401);
    });

    it('retorna 400 quando o payload não passa na validação (email ausente)', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({ password: 'x' });
      expect(res.status).toBe(400);
    });
  });

  describe('RBAC em rota protegida (GET /api/v1/products)', () => {
    it('retorna 401 sem token', async () => {
      const res = await request(app).get('/api/v1/products');
      expect(res.status).toBe(401);
    });

    it('retorna 403 com token válido mas sem a permissão products:read', async () => {
      const user = await createUserWithPermissions([]); // nenhuma permissão
      const login = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: 'Test@Password123' });

      const res = await request(app)
        .get('/api/v1/products')
        .set('Authorization', `Bearer ${login.body.data.accessToken}`);

      expect(res.status).toBe(403);
    });

    it('retorna 200 com token válido e a permissão products:read', async () => {
      const user = await createUserWithPermissions([{ resource: 'products', action: 'read' }]);
      const login = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: 'Test@Password123' });

      const res = await request(app)
        .get('/api/v1/products')
        .set('Authorization', `Bearer ${login.body.data.accessToken}`);

      expect(res.status).toBe(200);
    });
  });
});
