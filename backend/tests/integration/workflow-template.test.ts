import request from 'supertest';
import { app } from '../../src/app';
import { cleanDatabase, disconnectTestDb, testPrisma } from '../helpers/db';
import { createUserWithPermissions } from '../helpers/fixtures';
import { clearLicensedModuleCache } from '../../src/services/licensed-module.service';

const login = async (permissions: { resource: string; action: string }[]) => {
  const user = await createUserWithPermissions(permissions);
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: 'Test@Password123' });

  return res.body.data.accessToken as string;
};

const setModule = (code: string, enabled: boolean) =>
  testPrisma.licensedModule.create({ data: { code, enabled } });

describe('Integração: templates de workflow do WMS', () => {
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

  describe('POST /api/v1/wms-workflow-templates', () => {
    it('cria um template com grafo válido (Descarga -> Alocacao) e retorna 201', async () => {
      await setModule('WMS', true);
      const token = await login([
        { resource: 'estruturas_armazem', action: 'criar' },
        { resource: 'estruturas_armazem', action: 'visualizar' },
      ]);

      const response = await request(app)
        .post('/api/v1/wms-workflow-templates')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Fluxo padrão de teste',
          priority: 1,
          triggerRule: { field: 'product.weight', operator: 'gt', value: 0 },
          entryClientId: 'c1',
          nodes: [
            { clientId: 'c1', type: 'DESCARGA', positionX: 0, positionY: 0 },
            { clientId: 'c2', type: 'ALOCACAO', positionX: 0, positionY: 100 },
          ],
          edges: [{ fromClientId: 'c1', toClientId: 'c2' }],
        });

      expect(response.status).toBe(201);
      expect(response.body.data.entryNodeId).toBeTruthy();
      expect(response.body.data.nodes).toHaveLength(2);
    });

    it('rejeita um grafo inválido (Alocacao com saída) com 400', async () => {
      await setModule('WMS', true);
      const token = await login([{ resource: 'estruturas_armazem', action: 'criar' }]);

      const response = await request(app)
        .post('/api/v1/wms-workflow-templates')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Fluxo inválido',
          entryClientId: 'c1',
          nodes: [
            { clientId: 'c1', type: 'ALOCACAO', positionX: 0, positionY: 0 },
            { clientId: 'c2', type: 'DESCARGA', positionX: 0, positionY: 100 },
          ],
          edges: [{ fromClientId: 'c1', toClientId: 'c2' }],
        });

      expect(response.status).toBe(400);
    });

    it('rejeita payload sem entryClientId com 400 (Joi)', async () => {
      await setModule('WMS', true);
      const token = await login([{ resource: 'estruturas_armazem', action: 'criar' }]);

      const response = await request(app)
        .post('/api/v1/wms-workflow-templates')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Sem entrada', nodes: [], edges: [] });

      expect(response.status).toBe(400);
    });

    it('sem WMS licenciado, retorna 404 (requireModule), mesmo com a permissão', async () => {
      await setModule('WMS', false);
      const token = await login([{ resource: 'estruturas_armazem', action: 'criar' }]);

      const response = await request(app)
        .post('/api/v1/wms-workflow-templates')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'x', entryClientId: 'c1', nodes: [{ clientId: 'c1', type: 'ALOCACAO', positionX: 0, positionY: 0 }], edges: [] });

      expect(response.status).toBe(404);
    });

    it('sem permissão estruturas_armazem:criar, retorna 403', async () => {
      await setModule('WMS', true);
      const token = await login([]);

      const response = await request(app)
        .post('/api/v1/wms-workflow-templates')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'x', entryClientId: 'c1', nodes: [{ clientId: 'c1', type: 'ALOCACAO', positionX: 0, positionY: 0 }], edges: [] });

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/v1/wms-workflow-templates/:id, PUT, DELETE, /duplicate', () => {
    it('cria, edita o grafo inteiro, duplica e exclui um template', async () => {
      await setModule('WMS', true);
      const token = await login([
        { resource: 'estruturas_armazem', action: 'criar' },
        { resource: 'estruturas_armazem', action: 'editar' },
        { resource: 'estruturas_armazem', action: 'excluir' },
        { resource: 'estruturas_armazem', action: 'visualizar' },
      ]);

      const created = await request(app)
        .post('/api/v1/wms-workflow-templates')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Original',
          entryClientId: 'c1',
          nodes: [{ clientId: 'c1', type: 'ALOCACAO', positionX: 0, positionY: 0 }],
          edges: [],
        });
      const id = created.body.data.id;

      const updated = await request(app)
        .put(`/api/v1/wms-workflow-templates/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Editado',
          entryClientId: 'c1',
          nodes: [
            { clientId: 'c1', type: 'DESCARGA', positionX: 0, positionY: 0 },
            { clientId: 'c2', type: 'ALOCACAO', positionX: 0, positionY: 100 },
          ],
          edges: [{ fromClientId: 'c1', toClientId: 'c2' }],
        });
      expect(updated.status).toBe(200);
      expect(updated.body.data.nodes).toHaveLength(2);

      const duplicated = await request(app)
        .post(`/api/v1/wms-workflow-templates/${id}/duplicate`)
        .set('Authorization', `Bearer ${token}`);
      expect(duplicated.status).toBe(201);
      expect(duplicated.body.data.active).toBe(false);
      expect(duplicated.body.data.name).toBe('Editado (cópia)');

      const deleted = await request(app)
        .delete(`/api/v1/wms-workflow-templates/${id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(deleted.status).toBe(200);

      const getAfterDelete = await request(app)
        .get(`/api/v1/wms-workflow-templates/${id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(getAfterDelete.status).toBe(404);
    });
  });
});
