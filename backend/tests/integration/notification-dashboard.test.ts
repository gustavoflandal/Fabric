import request from 'supertest';
import { app } from '../../src/app';
import { cleanDatabase, disconnectTestDb, testPrisma } from '../helpers/db';
import { createTestUser } from '../helpers/fixtures';

/**
 * `GET /api/v1/notifications/dashboard`.
 *
 * NOTA: a documentação do módulo listava "dashboard de métricas" como pendência
 * NÃO VERIFICADA. Verificado agora: já existia `GET /notifications/metrics`
 * (`notificationService.getMetrics()`), consumido hoje pelo
 * `frontend/src/stores/notification.store.ts`. Este `/dashboard` é novo e
 * CONVIVE com aquele em vez de substituí-lo; o último caso deste arquivo existe
 * justamente para garantir que o endpoint antigo, que a tela usa, continua
 * respondendo.
 *
 * O ponto central é o ESCOPO POR USUÁRIO: todo número precisa ser do usuário
 * logado, nunca um agregado global.
 */

const login = async (email: string, password: string) => {
  const res = await request(app).post('/api/v1/auth/login').send({ email, password });
  return res.body.data.accessToken as string;
};

const seed = (
  userId: string,
  overrides: Partial<{
    priority: number;
    category: string;
    eventType: string;
    read: boolean;
    archived: boolean;
    createdAt: Date;
  }> = {}
) =>
  testPrisma.notification.create({
    data: {
      userId,
      type: 'WARNING',
      category: overrides.category ?? 'PRODUCTION',
      eventType: overrides.eventType ?? 'PRODUCTION_DELAYED',
      title: 'Teste',
      message: 'Teste',
      priority: overrides.priority ?? 3,
      read: overrides.read ?? false,
      archived: overrides.archived ?? false,
      createdAt: overrides.createdAt ?? new Date(),
    },
  });

const daysAgo = (n: number) => {
  const date = new Date();
  date.setDate(date.getDate() - n);
  date.setHours(12, 0, 0, 0);
  return date;
};

describe('Integração: GET /notifications/dashboard', () => {
  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('exige autenticação', async () => {
    const res = await request(app).get('/api/v1/notifications/dashboard');
    expect(res.status).toBe(401);
  });

  it('retorna os números certos para um cenário conhecido', async () => {
    const user = await createTestUser();
    const token = await login(user.email, 'Test@Password123');

    // 2 críticas não lidas, 3 altas não lidas, 1 média não lida = 6 não lidas.
    await seed(user.id, { priority: 4, category: 'STOCK', eventType: 'STOCK_BELOW_SAFETY' });
    await seed(user.id, { priority: 4, category: 'STOCK', eventType: 'STOCK_BELOW_SAFETY' });
    await seed(user.id, { priority: 3, category: 'PRODUCTION' });
    await seed(user.id, { priority: 3, category: 'PRODUCTION' });
    await seed(user.id, { priority: 3, category: 'WAREHOUSE', eventType: 'REPLENISHMENT_NEEDED' });
    await seed(user.id, { priority: 2, category: 'QUALITY', eventType: 'QUALITY_SCRAP_HIGH' });
    // Ruído: lida e arquivada não entram em nenhuma contagem de "não lidas".
    await seed(user.id, { priority: 4, read: true });
    await seed(user.id, { priority: 4, archived: true });

    const res = await request(app)
      .get('/api/v1/notifications/dashboard')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const data = res.body.data;

    expect(data.criticalUnread).toBe(2);
    expect(data.highUnread).toBe(3);
    expect(data.totalUnread).toBe(6);

    // Shape estável: toda categoria presente, WAREHOUSE inclusive.
    expect(data.byCategory).toEqual({
      PRODUCTION: 2,
      STOCK: 2,
      PURCHASE: 0,
      QUALITY: 1,
      CAPACITY: 0,
      WAREHOUSE: 1,
    });
  });

  it('escopa tudo ao usuário logado', async () => {
    const mine = await createTestUser();
    const other = await createTestUser();
    const token = await login(mine.email, 'Test@Password123');

    await seed(mine.id, { priority: 4 });
    // Notificações de outro usuário não podem aparecer em nenhum número.
    await seed(other.id, { priority: 4 });
    await seed(other.id, { priority: 4 });
    await seed(other.id, { priority: 3, category: 'WAREHOUSE' });

    const res = await request(app)
      .get('/api/v1/notifications/dashboard')
      .set('Authorization', `Bearer ${token}`);

    expect(res.body.data.criticalUnread).toBe(1);
    expect(res.body.data.totalUnread).toBe(1);
    expect(res.body.data.byCategory.WAREHOUSE).toBe(0);
    expect(res.body.data.topEvents.reduce((s: number, e: any) => s + e.count, 0)).toBe(1);
  });

  it('top 5 eventos vem ordenado por frequência e limitado a 5', async () => {
    const user = await createTestUser();
    const token = await login(user.email, 'Test@Password123');

    const plan: [string, number][] = [
      ['PRODUCTION_DELAYED', 5],
      ['STOCK_BELOW_SAFETY', 4],
      ['BOTTLENECK_DETECTED', 3],
      ['QUALITY_SCRAP_HIGH', 2],
      ['MATERIAL_UNAVAILABLE', 1],
      ['OPERATION_COMPLETED', 1],
    ];
    for (const [eventType, times] of plan) {
      for (let i = 0; i < times; i += 1) {
        await seed(user.id, { eventType });
      }
    }

    const res = await request(app)
      .get('/api/v1/notifications/dashboard')
      .set('Authorization', `Bearer ${token}`);

    const top = res.body.data.topEvents;
    expect(top).toHaveLength(5);
    expect(top[0]).toEqual({ eventType: 'PRODUCTION_DELAYED', count: 5 });
    expect(top[1]).toEqual({ eventType: 'STOCK_BELOW_SAFETY', count: 4 });
    expect(top[2]).toEqual({ eventType: 'BOTTLENECK_DETECTED', count: 3 });
    expect(top[3]).toEqual({ eventType: 'QUALITY_SCRAP_HIGH', count: 2 });
  });

  it('respeita a janela do top de eventos (query days)', async () => {
    const user = await createTestUser();
    const token = await login(user.email, 'Test@Password123');

    await seed(user.id, { eventType: 'RECENTE', createdAt: daysAgo(2) });
    await seed(user.id, { eventType: 'ANTIGO', createdAt: daysAgo(20) });

    // Padrão de 30 dias enxerga os dois.
    const wide = await request(app)
      .get('/api/v1/notifications/dashboard')
      .set('Authorization', `Bearer ${token}`);
    expect(wide.body.data.period.topEventsDays).toBe(30);
    expect(wide.body.data.topEvents.map((e: any) => e.eventType).sort()).toEqual([
      'ANTIGO',
      'RECENTE',
    ]);

    // Janela de 7 dias enxerga só o recente.
    const narrow = await request(app)
      .get('/api/v1/notifications/dashboard?days=7')
      .set('Authorization', `Bearer ${token}`);
    expect(narrow.body.data.period.topEventsDays).toBe(7);
    expect(narrow.body.data.topEvents).toEqual([{ eventType: 'RECENTE', count: 1 }]);
  });

  it('tendência traz 7 dias contíguos, com zeros nos dias sem notificação', async () => {
    const user = await createTestUser();
    const token = await login(user.email, 'Test@Password123');

    await seed(user.id, { priority: 4, createdAt: daysAgo(0) });
    await seed(user.id, { priority: 3, createdAt: daysAgo(2) });
    await seed(user.id, { priority: 2, createdAt: daysAgo(2) });

    const res = await request(app)
      .get('/api/v1/notifications/dashboard')
      .set('Authorization', `Bearer ${token}`);

    const trend = res.body.data.dailyTrend;
    expect(trend).toHaveLength(7);
    // Datas estritamente crescentes e sem buraco.
    const dates = trend.map((d: any) => d.date);
    expect([...dates].sort()).toEqual(dates);

    const today = trend[6];
    expect(today.total).toBe(1);
    expect(today.critical).toBe(1);
    expect(today.high).toBe(0);

    // Alta NÃO é contada como crítica (o endpoint antigo somava as duas).
    const twoDaysAgo = trend[4];
    expect(twoDaysAgo.total).toBe(2);
    expect(twoDaysAgo.high).toBe(1);
    expect(twoDaysAgo.critical).toBe(0);
  });

  it('rejeita days fora do intervalo permitido', async () => {
    const user = await createTestUser();
    const token = await login(user.email, 'Test@Password123');

    for (const bad of ['0', '-5', '400', 'abc']) {
      const res = await request(app)
        .get(`/api/v1/notifications/dashboard?days=${bad}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
    }
  });

  it('o endpoint /metrics preexistente continua funcionando', async () => {
    const user = await createTestUser();
    const token = await login(user.email, 'Test@Password123');
    await seed(user.id, { priority: 4 });

    const res = await request(app)
      .get('/api/v1/notifications/metrics')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.totalUnread).toBe(1);
  });
});
