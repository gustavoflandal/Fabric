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

  // `SET FOREIGN_KEY_CHECKS` e por sessao/conexao, nao por chamada. Disparado
  // via `await` sequencial, cada `$executeRawUnsafe` pode ser servido por uma
  // conexao diferente do pool interno do Prisma (o padrao cresce com o numero
  // de CPUs do host) - nesse caso o `SET ... = 0` fica preso numa conexao que
  // nunca roda o TRUNCATE seguinte, e o MySQL rejeita truncar uma tabela
  // referenciada por FK (erro 1701). `$transaction([...])` (forma array, nao
  // callback) fixa toda a sequencia numa unica conexao emprestada do pool.
  // So foi observado em CI (pool maior por mais CPUs no runner) - nunca em
  // execucao local - mas o bug de isolamento existe independente de quando
  // ele decide aparecer.
  await testPrisma.$transaction([
    testPrisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0'),
    ...tables.map(({ TABLE_NAME }) => testPrisma.$executeRawUnsafe(`TRUNCATE TABLE \`${TABLE_NAME}\``)),
    testPrisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1'),
  ]);
}

export async function disconnectTestDb(): Promise<void> {
  await testPrisma.$disconnect();
}
