import request from 'supertest';
import { app } from '../../src/app';
import { cleanDatabase, disconnectTestDb } from '../helpers/db';
import { createTestProduct, createUserWithPermissions } from '../helpers/fixtures';

// Fase 3 do cronograma, item 3.5: mesma verificação de
// tests/services/stock.service.test.ts, mas passando pela pilha HTTP
// completa (rotas, requirePermission, validators) em vez de chamar o
// service direto - é o cenário que foi testado manualmente ao vivo na Fase
// 1 (5 requisições POST /stock/exit em paralelo).

describe('Integração: concorrência de estoque via HTTP (Fase 3, item 3.5)', () => {
  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('5 saídas de estoque simultâneas via API nunca deixam o saldo negativo', async () => {
    const product = await createTestProduct();
    const user = await createUserWithPermissions([
      { resource: 'stock', action: 'entry' },
      { resource: 'stock', action: 'exit' },
      { resource: 'stock', action: 'read' },
    ]);

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'Test@Password123' });
    const token = login.body.data.accessToken;

    await request(app)
      .post('/api/v1/stock/entry')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product.id, quantity: 100, reason: 'entrada inicial' })
      .expect(201);

    const attempts = Array.from({ length: 5 }, (_, i) =>
      request(app)
        .post('/api/v1/stock/exit')
        .set('Authorization', `Bearer ${token}`)
        .send({ productId: product.id, quantity: 30, reason: `saída concorrente ${i}` })
    );

    const responses = await Promise.all(attempts);
    const succeeded = responses.filter((r) => r.status === 201);
    const failed = responses.filter((r) => r.status !== 201);

    expect(succeeded).toHaveLength(3);
    expect(failed).toHaveLength(2);

    const balanceRes = await request(app)
      .get(`/api/v1/stock/balance/${product.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(balanceRes.body.data.quantity).toBe(10);
  }, 20000);
});
