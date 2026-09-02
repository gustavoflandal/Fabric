import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/config/database';
import { cleanDatabase, disconnectTestDb, testPrisma } from '../helpers/db';
import { clearLicensedModuleCache } from '../../src/services/licensed-module.service';
import { createTestPositions, createUserWithPermissions } from '../helpers/fixtures';

/**
 * RBAC das rotas de cadastro de apoio (dashboard, unidades de medida) e da
 * atualização de posição individual de armazenagem.
 *
 * Duas coisas em jogo aqui:
 *
 * 1. `dashboard:read` e `units_of_measure:*` já eram exigidos pelas rotas, mas
 *    NÃO estavam nos mapas `managerPermissions`/`operatorPermissions` do
 *    seed — MANAGER e OPERATOR tomavam 403 no próprio dashboard. Os testes
 *    abaixo verificam o contrato da rota (sem a permissão → 403; com ela →
 *    200) usando exatamente os pares que o seed passa a atribuir a esses
 *    perfis, sem depender de rodar o seed contra o banco de teste (que é
 *    truncado a cada teste).
 *
 * 2. `PUT /storage-positions/position/:id` mudou de `storage_positions:update`
 *    para `estruturas_armazem:atualizar_posicao`. O teste do 403 com a
 *    permissão ANTIGA é o que impede a renomeação de ficar pela metade: se
 *    alguém reverter a rota sem reverter o seed (ou o contrário), ele quebra.
 */

const login = async (permissions: { resource: string; action: string }[]) => {
  const user = await createUserWithPermissions(permissions);
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: 'Test@Password123' });

  return res.body.data.accessToken as string;
};

// Pares como o seed os atribui: MANAGER escreve no cadastro, OPERATOR só lê.
const MANAGER_CADASTROS = [
  { resource: 'dashboard', action: 'read' },
  { resource: 'units_of_measure', action: 'create' },
  { resource: 'units_of_measure', action: 'read' },
  { resource: 'units_of_measure', action: 'update' },
];

const OPERATOR_CADASTROS = [
  { resource: 'dashboard', action: 'read' },
  { resource: 'units_of_measure', action: 'read' },
];

const NEW_POSITION_UPDATE = { resource: 'estruturas_armazem', action: 'atualizar_posicao' };
const OLD_POSITION_UPDATE = { resource: 'storage_positions', action: 'update' };

describe('Integração: RBAC de cadastros de apoio e de posição de armazenagem', () => {
  afterEach(async () => {
    await cleanDatabase();
    clearLicensedModuleCache();
  });

  afterAll(async () => {
    await disconnectTestDb();
    await prisma.$disconnect();
  });

  describe('GET /api/v1/dashboard/statistics', () => {
    it('retorna 403 para usuário autenticado sem dashboard:read', async () => {
      const token = await login([]);

      const res = await request(app)
        .get('/api/v1/dashboard/statistics')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it('retorna 200 com o conjunto de permissões que o seed dá ao MANAGER', async () => {
      const token = await login(MANAGER_CADASTROS);

      const res = await request(app)
        .get('/api/v1/dashboard/statistics')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it('retorna 200 com o conjunto de permissões que o seed dá ao OPERATOR', async () => {
      const token = await login(OPERATOR_CADASTROS);

      const res = await request(app)
        .get('/api/v1/dashboard/statistics')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });
  });

  describe('/api/v1/units-of-measure', () => {
    it('retorna 403 na listagem sem units_of_measure:read', async () => {
      const token = await login([]);

      const res = await request(app)
        .get('/api/v1/units-of-measure')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it('MANAGER lê e cria unidades de medida', async () => {
      const token = await login(MANAGER_CADASTROS);

      const list = await request(app)
        .get('/api/v1/units-of-measure')
        .set('Authorization', `Bearer ${token}`);
      expect(list.status).toBe(200);

      const created = await request(app)
        .post('/api/v1/units-of-measure')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: 'CX', name: 'Caixa', type: 'quantity', symbol: 'cx' });
      expect(created.status).toBe(201);
    });

    it('OPERATOR lê, mas NÃO cria (o seed não lhe dá units_of_measure:create)', async () => {
      const token = await login(OPERATOR_CADASTROS);

      const list = await request(app)
        .get('/api/v1/units-of-measure')
        .set('Authorization', `Bearer ${token}`);
      expect(list.status).toBe(200);

      const created = await request(app)
        .post('/api/v1/units-of-measure')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: 'PL', name: 'Palete', type: 'quantity', symbol: 'pl' });
      expect(created.status).toBe(403);
    });
  });

  describe('PUT /api/v1/storage-positions/position/:positionId (renomeação da permissão)', () => {
    beforeEach(async () => {
      clearLicensedModuleCache();
      await testPrisma.licensedModule.create({ data: { code: 'WMS', enabled: true } });
    });

    it('retorna 403 com a permissão ANTIGA storage_positions:update', async () => {
      const { positions } = await createTestPositions(1);
      const token = await login([OLD_POSITION_UPDATE]);

      const res = await request(app)
        .put(`/api/v1/storage-positions/position/${positions[0].id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ blocked: true });

      expect(res.status).toBe(403);
    });

    it('retorna 200 com estruturas_armazem:atualizar_posicao e aplica a mudança', async () => {
      const { positions } = await createTestPositions(1);
      const token = await login([NEW_POSITION_UPDATE]);

      const res = await request(app)
        .put(`/api/v1/storage-positions/position/${positions[0].id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ blocked: true });

      expect(res.status).toBe(200);

      const updated = await testPrisma.storagePosition.findUnique({
        where: { id: positions[0].id },
      });
      expect(updated?.blocked).toBe(true);
    });
  });
});
