import { PrismaClient } from '@prisma/client';

// Cliente de teste dedicado (aponta pro banco de teste via .env.test,
// carregado em tests/jest.setup.ts antes deste módulo ser importado).
export const testPrisma = new PrismaClient();

/**
 * Limpa todas as tabelas do banco de teste entre testes. Truncar via SQL cru
 * em vez de deleteMany por tabela: é mais simples de manter (não precisa
 * listar/ordenar manualmente todas as ~40 tabelas por dependência de FK) e
 * roda uma vez só contra um banco efêmero em tmpfs, então performance não é
 * problema.
 */
export async function cleanDatabase(): Promise<void> {
  const tables = await testPrisma.$queryRaw<{ TABLE_NAME: string }[]>`
    SELECT TABLE_NAME FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME != '_prisma_migrations'
  `;

  await testPrisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0');
  for (const { TABLE_NAME } of tables) {
    await testPrisma.$executeRawUnsafe(`TRUNCATE TABLE \`${TABLE_NAME}\``);
  }
  await testPrisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1');
}

export async function disconnectTestDb(): Promise<void> {
  await testPrisma.$disconnect();
}
