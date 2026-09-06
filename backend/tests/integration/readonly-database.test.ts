// backend/tests/integration/readonly-database.test.ts
import { readOnlyPrisma } from '../../src/config/readonly-database';
import { createTestProduct } from '../helpers/fixtures';
import { cleanDatabase, disconnectTestDb } from '../helpers/db';

/**
 * Teste de aceite exigido pela spec (seção 5): confirma que o usuário
 * `fabric_assistente` realmente NÃO tem permissão de escrita no MySQL — não
 * é uma checagem de código, é o banco recusando o comando.
 *
 * Pré-requisito: `backend/scripts/sql/create-readonly-user.sql` já deve ter
 * sido rodado contra o banco de teste (`fabric_test`) antes desta suíte
 * rodar — ver Task 13 (verificação fim a fim) para o passo operacional.
 */
describe('Integração: usuário MySQL read-only do assistente', () => {
  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await readOnlyPrisma.$disconnect();
    await disconnectTestDb();
  });

  it('SELECT funciona normalmente', async () => {
    const product = await createTestProduct();

    const result = await readOnlyPrisma.product.findUnique({ where: { id: product.id } });

    expect(result?.code).toBe(product.code);
  });

  it('INSERT falha por permissão do banco, não por validação do Prisma', async () => {
    const unit = await createTestProduct();

    await expect(
      readOnlyPrisma.product.create({
        data: {
          code: 'TENTATIVA-ESCRITA-INDEVIDA',
          name: 'Não deveria conseguir criar isso',
          type: 'raw_material',
          unitId: unit.unitId,
        },
      })
    ).rejects.toThrow(/command denied|access denied|SELECT command denied/i);
  });
});
