import permissionService from '../../src/services/permission.service';
import { testPrisma, cleanDatabase, disconnectTestDb } from '../helpers/db';

// Fase 3 do cronograma, item 3.4 (extra): permission.service.ts é CRUD puro
// sobre a tabela `permissions` (getAll/getById/create/delete/seedDefaultPermissions)
// - a checagem "esse usuário tem permissão X:Y via algum dos seus papéis?"
// NÃO mora aqui, e sim em `src/middleware/permission.middleware.ts`
// (requirePermission), que consulta usuário -> roles -> role.permissions
// diretamente via Prisma. Ver tests/middleware/permission.middleware.test.ts
// para a cobertura dessa checagem "com e sem permissão via role".

describe('permission.service (Fase 3, item 3.4 extra)', () => {
  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  let resourceCounter = 0;
  function uniqueResource() {
    resourceCounter += 1;
    return `test-resource-${resourceCounter}`;
  }

  describe('create()', () => {
    it('cria uma permissão nova', async () => {
      const resource = uniqueResource();
      const permission = await permissionService.create({
        resource,
        action: 'read',
        description: 'Ler recurso de teste',
      });

      expect(permission.id).toEqual(expect.any(String));
      expect(permission.resource).toBe(resource);
      expect(permission.action).toBe('read');
    });

    it('rejeita permissão duplicada (mesmo resource+action)', async () => {
      const resource = uniqueResource();
      await permissionService.create({ resource, action: 'read' });

      await expect(permissionService.create({ resource, action: 'read' })).rejects.toMatchObject({
        statusCode: 409,
      });
    });
  });

  describe('getById()', () => {
    it('retorna a permissão existente', async () => {
      const resource = uniqueResource();
      const created = await permissionService.create({ resource, action: 'update' });

      const found = await permissionService.getById(created.id);
      expect(found.id).toBe(created.id);
    });

    it('lança 404 para permissão inexistente', async () => {
      await expect(permissionService.getById('id-inexistente')).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  describe('delete()', () => {
    it('remove uma permissão existente', async () => {
      const resource = uniqueResource();
      const created = await permissionService.create({ resource, action: 'delete' });

      await permissionService.delete(created.id);

      const stillThere = await testPrisma.permission.findUnique({ where: { id: created.id } });
      expect(stillThere).toBeNull();
    });

    it('lança 404 ao tentar remover permissão inexistente', async () => {
      await expect(permissionService.delete('id-inexistente')).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  describe('getAll()', () => {
    it('agrupa as permissões por resource', async () => {
      const resourceA = uniqueResource();
      const resourceB = uniqueResource();
      await permissionService.create({ resource: resourceA, action: 'read' });
      await permissionService.create({ resource: resourceA, action: 'update' });
      await permissionService.create({ resource: resourceB, action: 'read' });

      const { all, grouped } = await permissionService.getAll();

      expect(all.length).toBeGreaterThanOrEqual(3);
      expect(grouped[resourceA]).toHaveLength(2);
      expect(grouped[resourceB]).toHaveLength(1);
    });
  });
});
