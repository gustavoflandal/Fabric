import logCleanupJob from '../../src/jobs/log-cleanup.job';
import { testPrisma, cleanDatabase, disconnectTestDb } from '../helpers/db';
import { clearSettingCache } from '../../src/services/system-setting.service';
import { createTestUser } from '../helpers/fixtures';

describe('LogCleanupJob — audit.retention_days configurável', () => {
  afterEach(async () => {
    clearSettingCache();
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('usa audit.retention_days do banco em vez do default de 90 dias', async () => {
    const user = await createTestUser();

    const oldLog = await testPrisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'read',
        resource: 'test',
        description: 'log antigo',
        method: 'GET',
        endpoint: '/test',
        statusCode: 200,
      },
    });
    // 40 dias atrás: sobreviveria ao default (90) mas não a uma retenção de 30.
    await testPrisma.auditLog.update({
      where: { id: oldLog.id },
      data: { createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000) },
    });

    await testPrisma.systemSetting.create({
      data: {
        key: 'audit.retention_days',
        value: '30',
        type: 'NUMBER',
        category: 'auditoria',
        label: 'Retenção de logs de auditoria (dias)',
      },
    });
    clearSettingCache();

    await logCleanupJob.runManually();

    const remaining = await testPrisma.auditLog.findUnique({ where: { id: oldLog.id } });
    expect(remaining).toBeNull();
  });
});
