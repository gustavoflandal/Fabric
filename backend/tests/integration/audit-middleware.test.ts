import request from 'supertest';
import { app } from '../../src/app';
import { cleanDatabase, disconnectTestDb, testPrisma } from '../helpers/db';
import { createUserWithPermissions } from '../helpers/fixtures';
import { clearSettingCache } from '../../src/services/system-setting.service';

/**
 * auditMiddleware (backend/src/middleware/audit.middleware.ts) respeitando
 * audit.mode/audit.include_reads vindos do banco em vez de config.audit.*
 * fixo. Usa a rota /api/v1/roles como alvo real (POST=escrita, GET=leitura)
 * porque não está na lista excludedPaths do middleware.
 *
 * Filtra por `endpoint`+`method` (gravados a partir de `req.originalUrl`/
 * `req.method`), NÃO por `resource` (derivado de `req.path`) — este último
 * tem um bug pré-existente e fora do escopo desta task: para rotas de
 * coleção montadas com padrão '/' no roteador mais interno (como
 * `roleRoutes.get('/', ...)`/`.post('/', ...)`), o Express não restaura
 * `req.path` para o valor completo por ocasião do `res.on('finish')`, então
 * `resource` sai como 'unknown' em vez de 'roles'. Ver seção "Achado — bug
 * pré-existente fora de escopo" no relatório desta task.
 */
const loginWith = async (permissions: { resource: string; action: string }[]) => {
  const user = await createUserWithPermissions(permissions);
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: 'Test@Password123' });
  return res.body.data.accessToken as string;
};

/**
 * O audit log é gravado em `res.on('finish', async () => {...})`, DEPOIS
 * que a resposta HTTP já foi enviada ao cliente — então `await request(...)`
 * resolve antes da escrita no banco necessariamente ter terminado. Poll
 * curto em vez de checar uma vez só, para não depender de quão rápido o
 * event loop processa a Promise pendente em cada ambiente/CI.
 */
const waitForAuditLogs = async (where: { endpoint: string; method: string }, minCount = 1) => {
  const deadline = Date.now() + 1000;
  let logs = await testPrisma.auditLog.findMany({ where });
  while (logs.length < minCount && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 20));
    logs = await testPrisma.auditLog.findMany({ where });
  }
  return logs;
};

describe('Integração: auditMiddleware — audit.mode/audit.include_reads configuráveis', () => {
  afterEach(async () => {
    clearSettingCache();
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('audit.mode = "none" não grava nenhum log, nem de escrita', async () => {
    await testPrisma.systemSetting.create({
      data: { key: 'audit.mode', value: 'none', type: 'STRING', category: 'auditoria', label: 'Modo de auditoria' },
    });
    clearSettingCache();

    const token = await loginWith([{ resource: 'roles', action: 'create' }]);
    await request(app)
      .post('/api/v1/roles')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'TESTE-AUDIT-1', name: 'Perfil Teste' });

    const logs = await testPrisma.auditLog.findMany({ where: { endpoint: '/api/v1/roles', method: 'POST' } });
    expect(logs).toHaveLength(0);
  });

  it('audit.mode = "write_only" grava POST mas não GET bem-sucedido', async () => {
    await testPrisma.systemSetting.create({
      data: { key: 'audit.mode', value: 'write_only', type: 'STRING', category: 'auditoria', label: 'Modo de auditoria' },
    });
    clearSettingCache();

    const token = await loginWith([
      { resource: 'roles', action: 'create' },
      { resource: 'roles', action: 'read' },
    ]);

    await request(app)
      .post('/api/v1/roles')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'TESTE-AUDIT-2', name: 'Perfil Teste 2' });
    await request(app).get('/api/v1/roles').set('Authorization', `Bearer ${token}`);

    const writeLogs = await waitForAuditLogs({ endpoint: '/api/v1/roles', method: 'POST' });
    expect(writeLogs.length).toBeGreaterThanOrEqual(1);

    const readLogs = await testPrisma.auditLog.findMany({ where: { endpoint: '/api/v1/roles', method: 'GET' } });
    expect(readLogs).toHaveLength(0);
  });

  it('audit.mode = "all" com audit.include_reads = "true" grava também leituras bem-sucedidas', async () => {
    await testPrisma.systemSetting.create({
      data: { key: 'audit.mode', value: 'all', type: 'STRING', category: 'auditoria', label: 'Modo de auditoria' },
    });
    await testPrisma.systemSetting.create({
      data: { key: 'audit.include_reads', value: 'true', type: 'BOOLEAN', category: 'auditoria', label: 'Incluir leituras' },
    });
    clearSettingCache();

    const token = await loginWith([{ resource: 'roles', action: 'read' }]);
    await request(app).get('/api/v1/roles').set('Authorization', `Bearer ${token}`);

    const readLogs = await waitForAuditLogs({ endpoint: '/api/v1/roles', method: 'GET' });
    expect(readLogs.length).toBeGreaterThanOrEqual(1);
  });
});
