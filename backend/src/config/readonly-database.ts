// backend/src/config/readonly-database.ts
import { PrismaClient } from '@prisma/client';
import { config } from './env';

/**
 * Segunda instância do Prisma Client, conectada com o usuário MySQL
 * `fabric_assistente` (GRANT SELECT apenas — ver
 * backend/scripts/sql/create-readonly-user.sql). As 3 funções de consulta de
 * estoque do assistente (Fase 2) usam EXCLUSIVAMENTE este client — nunca o
 * `prisma` normal de `config/database.ts`. Read-only é imposto pelo banco,
 * não só pelo código: um INSERT por esta conexão falha por permissão do
 * MySQL, verificado em `tests/integration/readonly-database.test.ts`.
 */
export const readOnlyPrisma = new PrismaClient({
  datasources: {
    db: {
      url: config.assistant.readOnlyDatabaseUrl,
    },
  },
});
