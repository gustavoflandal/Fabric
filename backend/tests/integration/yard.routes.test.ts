import request from 'supertest';
import { app } from '../../src/app';
import { cleanDatabase, disconnectTestDb, testPrisma } from '../helpers/db';
import { createTestPositions, createTestSupplier, createUserWithPermissions } from '../helpers/fixtures';
import { clearLicensedModuleCache } from '../../src/services/licensed-module.service';

/**
 * Finding 2 (Important) da revisão final da Etapa 1 (Cadastros Base) do YMS:
 * as 5 montagens de rota do módulo (`/yard-docks`, `/drivers`, `/fleets`,
 * `/vehicles`, `/yard-warehouse-params`, todas com `requireModule('YMS')` em
 * `routes/index.ts`) tinham zero cobertura HTTP das duas camadas que as
 * protegem: a licença da INSTALAÇÃO (`requireModule`) e a permissão do
 * USUÁRIO (`requirePermission('yard', ...)`). Todo teste existente do YMS era
 * de service, então um refactor futuro de `routes/index.ts` ou da cadeia de
 * middleware de RBAC poderia quebrar qualquer um dos dois gates sem que nada
 * acusasse.
 *
 * Segue o mesmo padrão de `module-licensing.test.ts` (licenciamento) e
 * `maintenance-order.routes.test.ts` (granularidade exata de
 * `requirePermission`, sem hierarquia entre `visualizar` e `gerenciar`).
 */

const login = async (permissions: { resource: string; action: string }[]) => {
  const user = await createUserWithPermissions(permissions);
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: 'Test@Password123' });

  return res.body.data.accessToken as string;
};

const setYmsModule = (enabled: boolean) => testPrisma.licensedModule.create({ data: { code: 'YMS', enabled } });

const VISUALIZAR = { resource: 'yard', action: 'visualizar' };
const GERENCIAR = { resource: 'yard', action: 'gerenciar' };

describe('Integração: licenciamento e RBAC das rotas do YMS', () => {
  beforeEach(() => {
    clearLicensedModuleCache();
  });

  afterEach(async () => {
    await cleanDatabase();
    clearLicensedModuleCache();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  describe('requireModule("YMS") nas 5 montagens de rota', () => {
    it('responde 404 (não 403) em todas as 5 montagens quando o YMS está desabilitado, mesmo com o usuário tendo permissão total', async () => {
      await setYmsModule(false);
      const token = await login([VISUALIZAR, GERENCIAR]);
      const auth = () => ({ Authorization: `Bearer ${token}` });

      const yardDocks = await request(app).get('/api/v1/yard-docks').set(auth());
      const drivers = await request(app).get('/api/v1/drivers').set(auth());
      const fleets = await request(app).get('/api/v1/fleets').set(auth());
      const vehicles = await request(app).get('/api/v1/vehicles').set(auth());
      const warehouseParams = await request(app)
        .get('/api/v1/yard-warehouse-params/id-qualquer')
        .set(auth());

      // 404 e não 403: o módulo deve PARECER não existir para uma instalação
      // que não o licenciou, mesmo que o usuário tenha a permissão RBAC.
      expect(yardDocks.status).toBe(404);
      expect(drivers.status).toBe(404);
      expect(fleets.status).toBe(404);
      expect(vehicles.status).toBe(404);
      expect(warehouseParams.status).toBe(404);
    });

    it('responde 404 nas 5 montagens quando a linha do módulo nem existe na tabela (fail-closed)', async () => {
      // nenhuma linha de licensed_modules criada para 'YMS'
      const token = await login([VISUALIZAR, GERENCIAR]);
      const auth = () => ({ Authorization: `Bearer ${token}` });

      const yardDocks = await request(app).get('/api/v1/yard-docks').set(auth());
      const drivers = await request(app).get('/api/v1/drivers').set(auth());
      const fleets = await request(app).get('/api/v1/fleets').set(auth());
      const vehicles = await request(app).get('/api/v1/vehicles').set(auth());
      const warehouseParams = await request(app)
        .get('/api/v1/yard-warehouse-params/id-qualquer')
        .set(auth());

      expect(yardDocks.status).toBe(404);
      expect(drivers.status).toBe(404);
      expect(fleets.status).toBe(404);
      expect(vehicles.status).toBe(404);
      expect(warehouseParams.status).toBe(404);
    });

    it('não bloqueia (o gate deixa passar) nas 5 montagens quando o YMS está habilitado, para o mesmo usuário permissionado', async () => {
      await setYmsModule(true);
      const token = await login([VISUALIZAR, GERENCIAR]);
      const auth = () => ({ Authorization: `Bearer ${token}` });

      const yardDocks = await request(app).get('/api/v1/yard-docks').set(auth());
      const drivers = await request(app).get('/api/v1/drivers').set(auth());
      const fleets = await request(app).get('/api/v1/fleets').set(auth());
      const vehicles = await request(app).get('/api/v1/vehicles').set(auth());
      // yard-warehouse-params/:warehouseId nunca dá 404 "de verdade": quando
      // não existe linha própria para o armazém, o service devolve os
      // defaults (200) em vez de erro — então aqui um 200 já prova, sozinho,
      // que o gate do módulo deixou passar (um id qualquer não bloqueia).
      const warehouseParams = await request(app)
        .get('/api/v1/yard-warehouse-params/id-qualquer')
        .set(auth());

      expect(yardDocks.status).toBe(200);
      expect(drivers.status).toBe(200);
      expect(fleets.status).toBe(200);
      expect(vehicles.status).toBe(200);
      expect(warehouseParams.status).toBe(200);
    });
  });

  describe('requirePermission("yard", ...) — checagem exata, sem hierarquia', () => {
    describe('/yard-docks (GET exige visualizar, POST exige gerenciar)', () => {
      it('usuário com apenas "visualizar": 200 no GET, 403 no POST', async () => {
        await setYmsModule(true);
        const { warehouse } = await createTestPositions(1, { positionType: 'DOCA' });
        const token = await login([VISUALIZAR]);
        const auth = () => ({ Authorization: `Bearer ${token}` });

        const get = await request(app).get('/api/v1/yard-docks').set(auth());
        const post = await request(app)
          .post('/api/v1/yard-docks')
          .set(auth())
          .send({ code: 'DOCA-RBAC-1', serviceType: 'RECEBIMENTO', warehouseId: warehouse.id });

        expect(get.status).toBe(200);
        expect(post.status).toBe(403);
      });

      it('usuário com apenas "gerenciar": 403 no GET, 201 no POST', async () => {
        await setYmsModule(true);
        const { warehouse } = await createTestPositions(1, { positionType: 'DOCA' });
        const token = await login([GERENCIAR]);
        const auth = () => ({ Authorization: `Bearer ${token}` });

        const get = await request(app).get('/api/v1/yard-docks').set(auth());
        const post = await request(app)
          .post('/api/v1/yard-docks')
          .set(auth())
          .send({ code: 'DOCA-RBAC-2', serviceType: 'RECEBIMENTO', warehouseId: warehouse.id });

        expect(get.status).toBe(403);
        expect(post.status).toBe(201);
      });
    });

    describe('/drivers (GET exige visualizar, POST exige gerenciar)', () => {
      it('usuário com apenas "visualizar": 200 no GET, 403 no POST', async () => {
        await setYmsModule(true);
        const supplier = await createTestSupplier();
        const token = await login([VISUALIZAR]);
        const auth = () => ({ Authorization: `Bearer ${token}` });

        const get = await request(app).get('/api/v1/drivers').set(auth());
        const post = await request(app)
          .post('/api/v1/drivers')
          .set(auth())
          .send({ name: 'Motorista RBAC 1', cpf: '11122233301', supplierId: supplier.id });

        expect(get.status).toBe(200);
        expect(post.status).toBe(403);
      });

      it('usuário com apenas "gerenciar": 403 no GET, 201 no POST', async () => {
        await setYmsModule(true);
        const supplier = await createTestSupplier();
        const token = await login([GERENCIAR]);
        const auth = () => ({ Authorization: `Bearer ${token}` });

        const get = await request(app).get('/api/v1/drivers').set(auth());
        const post = await request(app)
          .post('/api/v1/drivers')
          .set(auth())
          .send({ name: 'Motorista RBAC 2', cpf: '11122233302', supplierId: supplier.id });

        expect(get.status).toBe(403);
        expect(post.status).toBe(201);
      });
    });
  });
});
