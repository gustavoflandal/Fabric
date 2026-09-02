import request from 'supertest';
import { app } from '../../src/app';
import { cleanDatabase, disconnectTestDb, testPrisma } from '../helpers/db';
import { createUserWithPermissions } from '../helpers/fixtures';
import { clearLicensedModuleCache } from '../../src/services/licensed-module.service';

/**
 * F0.8 do plano do WMS
 * (docs/fase-2026-09-modernizacao/WMS_IMPLEMENTATION_ANALYSIS.md), implementando
 * a seção 3.1 de 04_ARQUITETURA_MODULAR_LICENCIAMENTO.md.
 *
 * O que estes testes protegem é justamente a diferença entre as DUAS camadas:
 * licença da INSTALAÇÃO (requireModule) e permissão do USUÁRIO
 * (requirePermission). O risco concreto documentado é um admin de um cliente
 * só-PCP se autoconceder `armazens:visualizar` e usar rotas de um módulo que
 * não foi vendido a ele — por isso o caso central aqui é "usuário COM a
 * permissão + módulo NÃO licenciado" e o esperado é 404, não 403.
 *
 * `clearLicensedModuleCache()` no beforeEach é obrigatório: o cache é
 * proposital e vive no módulo, enquanto `cleanDatabase()` trunca
 * `licensed_modules` entre os testes.
 */

const login = async (permissions: { resource: string; action: string }[]) => {
  const user = await createUserWithPermissions(permissions);
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: 'Test@Password123' });

  return res.body.data.accessToken as string;
};

const setModule = (code: string, enabled: boolean) =>
  testPrisma.licensedModule.create({ data: { code, enabled } });

describe('Integração: licenciamento de módulo (F0.8)', () => {
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

  describe('requireModule("WMS") nas rotas de armazém', () => {
    it('deixa passar (200) quando o WMS está licenciado e o usuário tem a permissão', async () => {
      await setModule('WMS', true);
      const token = await login([{ resource: 'armazens', action: 'visualizar' }]);

      const res = await request(app)
        .get('/api/v1/warehouses')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it('responde 404 (não 403) com o WMS desabilitado, MESMO com a permissão do usuário', async () => {
      await setModule('WMS', false);
      const token = await login([{ resource: 'armazens', action: 'visualizar' }]);

      const res = await request(app)
        .get('/api/v1/warehouses')
        .set('Authorization', `Bearer ${token}`);

      // 404 e não 403 é decisão de desenho: o módulo deve PARECER não existir
      // para quem não o licenciou, em vez de "existe, mas você não pode".
      expect(res.status).toBe(404);
    });

    it('responde 404 quando o módulo nem existe na tabela (fail-closed)', async () => {
      // nenhuma linha de licensed_modules criada
      const token = await login([{ resource: 'armazens', action: 'visualizar' }]);

      const res = await request(app)
        .get('/api/v1/warehouses')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it('cobre também /warehouse-structures e /storage-positions', async () => {
      await setModule('WMS', false);
      const token = await login([
        { resource: 'estruturas_armazem', action: 'visualizar' },
      ]);

      const structures = await request(app)
        .get('/api/v1/warehouse-structures')
        .set('Authorization', `Bearer ${token}`);
      const byCode = await request(app)
        .get('/api/v1/storage-positions/by-code/ARM1-R01-01-01')
        .set('Authorization', `Bearer ${token}`);

      expect(structures.status).toBe(404);
      expect(byCode.status).toBe(404);
    });

    it('continua exigindo a permissão do usuário mesmo com o módulo licenciado', async () => {
      await setModule('WMS', true);
      const token = await login([]); // autenticado, sem nenhuma permissão

      const res = await request(app)
        .get('/api/v1/warehouses')
        .set('Authorization', `Bearer ${token}`);

      // Licença é a camada da INSTALAÇÃO; o RBAC por usuário continua valendo.
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/system/licensed-modules', () => {
    it('exige autenticação', async () => {
      const res = await request(app).get('/api/v1/system/licensed-modules');
      expect(res.status).toBe(401);
    });

    it('lista os módulos conhecidos sem exigir permissão específica', async () => {
      await setModule('PCP', true);
      await setModule('WMS', true);
      const token = await login([]); // nenhuma permissão de negócio

      const res = await request(app)
        .get('/api/v1/system/licensed-modules')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(
        expect.arrayContaining([
          { code: 'PCP', enabled: true },
          { code: 'WMS', enabled: true },
          // YMS não tem linha na tabela: aparece como não licenciado, para o
          // frontend não precisar diferenciar "desligado" de "não configurado".
          { code: 'YMS', enabled: false },
        ])
      );
    });
  });
});
