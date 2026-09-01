import { testPrisma, cleanDatabase, disconnectTestDb } from './db';
import { createTestProduct } from './fixtures';

describe('infraestrutura de testes (Fase 3, item 3.1)', () => {
  afterAll(async () => {
    await disconnectTestDb();
  });

  it('conecta no banco de teste (não no banco de dev)', async () => {
    const rows = await testPrisma.$queryRaw<{ db: string }[]>`SELECT DATABASE() as db`;
    expect(rows[0].db).toBe('fabric_test');
  });

  it('cleanDatabase() limpa as tabelas entre testes', async () => {
    await createTestProduct();
    expect(await testPrisma.product.count()).toBeGreaterThan(0);

    await cleanDatabase();

    expect(await testPrisma.product.count()).toBe(0);
  });
});
