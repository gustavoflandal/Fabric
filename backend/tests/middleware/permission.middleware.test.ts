import { requirePermission } from '../../src/middleware/permission.middleware';
import { AuthRequest } from '../../src/middleware/auth.middleware';
import { AppError } from '../../src/middleware/error.middleware';
import { testPrisma, cleanDatabase, disconnectTestDb } from '../helpers/db';
import { createTestUser } from '../helpers/fixtures';

// Fase 3 do cronograma, item 3.4 (extra): a checagem real de "esse usuário
// tem a permissão resource:action, via algum dos seus papéis?" mora em
// requirePermission() (src/middleware/permission.middleware.ts), não em
// permission.service.ts (que é só CRUD de Permission - ver
// tests/services/permission.service.test.ts). Testado aqui invocando o
// middleware diretamente contra o banco de teste real, com req/next fake.

describe('requirePermission middleware (Fase 3, item 3.4 extra)', () => {
  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  let roleCounter = 0;
  let permCounter = 0;

  async function createRoleWithPermission(resource: string, action: string) {
    roleCounter += 1;
    permCounter += 1;
    const permission = await testPrisma.permission.create({
      data: { resource, action, description: `${resource}:${action}` },
    });
    const role = await testPrisma.role.create({
      data: {
        code: `ROLE-TEST-${roleCounter}`,
        name: `Papel de Teste ${roleCounter}`,
        permissions: { create: [{ permissionId: permission.id }] },
      },
    });
    return { role, permission };
  }

  function fakeReq(userId: string): AuthRequest {
    return { userId } as AuthRequest;
  }

  function fakeRes() {
    return {} as any;
  }

  it('chama next() sem erro quando o usuário tem a permissão via papel', async () => {
    const user = await createTestUser();
    const { role } = await createRoleWithPermission('reports', 'export');
    await testPrisma.userRole.create({ data: { userId: user.id, roleId: role.id } });

    const next = jest.fn();
    await requirePermission('reports', 'export')(fakeReq(user.id), fakeRes(), next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(); // sem argumento = sucesso
  });

  it('chama next(AppError 403) quando o usuário NÃO tem a permissão', async () => {
    const user = await createTestUser();
    // Papel existe e tem OUTRA permissão, mas não a exigida
    const { role } = await createRoleWithPermission('reports', 'read');
    await testPrisma.userRole.create({ data: { userId: user.id, roleId: role.id } });

    const next = jest.fn();
    await requirePermission('reports', 'export')(fakeReq(user.id), fakeRes(), next);

    expect(next).toHaveBeenCalledTimes(1);
    const errorArg = next.mock.calls[0][0];
    expect(errorArg).toBeInstanceOf(AppError);
    expect(errorArg.statusCode).toBe(403);
  });

  it('chama next(AppError 403) quando o usuário não tem nenhum papel', async () => {
    const user = await createTestUser();

    const next = jest.fn();
    await requirePermission('reports', 'export')(fakeReq(user.id), fakeRes(), next);

    expect(next).toHaveBeenCalledTimes(1);
    const errorArg = next.mock.calls[0][0];
    expect(errorArg).toBeInstanceOf(AppError);
    expect(errorArg.statusCode).toBe(403);
  });

  it('chama next(AppError 401) quando não há userId autenticado na requisição', async () => {
    const next = jest.fn();
    await requirePermission('reports', 'export')({} as AuthRequest, fakeRes(), next);

    expect(next).toHaveBeenCalledTimes(1);
    const errorArg = next.mock.calls[0][0];
    expect(errorArg).toBeInstanceOf(AppError);
    expect(errorArg.statusCode).toBe(401);
  });
});
