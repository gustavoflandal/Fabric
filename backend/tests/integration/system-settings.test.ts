import request from 'supertest';
import { app } from '../../src/app';
import { cleanDatabase, disconnectTestDb, testPrisma } from '../helpers/db';
import { createUserWithPermissions } from '../helpers/fixtures';

const createSetting = (overrides: Partial<{
  key: string; value: string; type: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON'; category: string;
}> = {}) =>
  testPrisma.systemSetting.create({
    data: {
      key: 'wms.task_delay_threshold_hours',
      value: '24',
      type: 'NUMBER',
      category: 'wms',
      label: 'Limiar de tarefa atrasada (horas)',
      description: null,
      ...overrides,
    },
  });

const loginWith = async (permissions: { resource: string; action: string }[]) => {
  const user = await createUserWithPermissions(permissions);
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: 'Test@Password123' });
  return res.body.data.accessToken as string;
};

describe('Integração: GET/PATCH /api/v1/system/settings', () => {
  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  describe('GET /api/v1/system/settings', () => {
    it('lista as configurações para quem tem system_settings:read', async () => {
      await createSetting();
      const token = await loginWith([{ resource: 'system_settings', action: 'read' }]);

      const res = await request(app)
        .get('/api/v1/system/settings')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].key).toBe('wms.task_delay_threshold_hours');
    });

    it('nega 403 para quem não tem system_settings:read', async () => {
      const token = await loginWith([{ resource: 'outra_coisa', action: 'visualizar' }]);

      const res = await request(app)
        .get('/api/v1/system/settings')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /api/v1/system/settings/:key', () => {
    it('atualiza o valor para quem tem system_settings:update', async () => {
      await createSetting();
      const token = await loginWith([{ resource: 'system_settings', action: 'update' }]);

      const res = await request(app)
        .patch('/api/v1/system/settings/wms.task_delay_threshold_hours')
        .set('Authorization', `Bearer ${token}`)
        .send({ value: '48' });

      expect(res.status).toBe(200);
      expect(res.body.data.value).toBe('48');

      const row = await testPrisma.systemSetting.findUnique({
        where: { key: 'wms.task_delay_threshold_hours' },
      });
      expect(row!.value).toBe('48');
    });

    it('nega 403 para quem só tem system_settings:read (não update)', async () => {
      await createSetting();
      const token = await loginWith([{ resource: 'system_settings', action: 'read' }]);

      const res = await request(app)
        .patch('/api/v1/system/settings/wms.task_delay_threshold_hours')
        .set('Authorization', `Bearer ${token}`)
        .send({ value: '48' });

      expect(res.status).toBe(403);
    });

    it('rejeita valor incompatível com o type com 400', async () => {
      await createSetting();
      const token = await loginWith([{ resource: 'system_settings', action: 'update' }]);

      const res = await request(app)
        .patch('/api/v1/system/settings/wms.task_delay_threshold_hours')
        .set('Authorization', `Bearer ${token}`)
        .send({ value: 'abc' });

      expect(res.status).toBe(400);
    });

    it('rejeita body sem "value" com 400 (validação Joi)', async () => {
      await createSetting();
      const token = await loginWith([{ resource: 'system_settings', action: 'update' }]);

      const res = await request(app)
        .patch('/api/v1/system/settings/wms.task_delay_threshold_hours')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('responde 404 para chave inexistente', async () => {
      const token = await loginWith([{ resource: 'system_settings', action: 'update' }]);

      const res = await request(app)
        .patch('/api/v1/system/settings/chave.inexistente')
        .set('Authorization', `Bearer ${token}`)
        .send({ value: '1' });

      expect(res.status).toBe(404);
    });
  });
});
