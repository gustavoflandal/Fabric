import {
  getSetting,
  listSettings,
  updateSetting,
  clearSettingCache,
} from '../../src/services/system-setting.service';
import { testPrisma, cleanDatabase, disconnectTestDb } from '../helpers/db';
import { AppError } from '../../src/middleware/error.middleware';
import { prisma } from '../../src/config/database';

const createSetting = (overrides: Partial<{
  key: string; value: string; type: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON';
  category: string; label: string; description: string | null;
}> = {}) =>
  testPrisma.systemSetting.create({
    data: {
      key: 'wms.task_delay_threshold_hours',
      value: '24',
      type: 'NUMBER',
      category: 'wms',
      label: 'Limiar de tarefa atrasada (horas)',
      description: null,
      ...overrides,
    },
  });

describe('system-setting.service', () => {
  afterEach(async () => {
    clearSettingCache();
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  describe('getSetting', () => {
    it('devolve o fallback quando não há linha para a chave', async () => {
      const value = await getSetting('wms.task_delay_threshold_hours', 24);
      expect(value).toBe(24);
    });

    it('devolve o valor do banco, já convertido pelo type, quando a linha existe', async () => {
      await createSetting({ value: '48' });
      const value = await getSetting('wms.task_delay_threshold_hours', 24);
      expect(value).toBe(48);
    });

    it('faz só uma consulta ao banco para chamadas concorrentes (dedupe do carregamento)', async () => {
      await createSetting();
      // O serviço usa `prisma` (backend/src/config/database) internamente —
      // não `testPrisma`, que é uma instância DIFERENTE de PrismaClient usada
      // pelos testes só para preparar/inspecionar dados. Espionar `testPrisma`
      // não intercepta a chamada real feita pelo serviço.
      const spy = jest.spyOn(prisma.systemSetting, 'findMany');

      await Promise.all([
        getSetting('wms.task_delay_threshold_hours', 24),
        getSetting('wms.task_delay_threshold_hours', 24),
        getSetting('wms.task_delay_threshold_hours', 24),
      ]);

      expect(spy).toHaveBeenCalledTimes(1);
      spy.mockRestore();
    });
  });

  describe('listSettings', () => {
    it('lista ordenado por categoria e depois por chave', async () => {
      await createSetting({ key: 'wms.b', category: 'wms', label: 'B' });
      await createSetting({ key: 'wms.a', category: 'wms', label: 'A' });
      await createSetting({ key: 'auditoria.x', category: 'auditoria', label: 'X' });

      const rows = await listSettings();
      expect(rows.map((r) => r.key)).toEqual(['auditoria.x', 'wms.a', 'wms.b']);
    });
  });

  describe('updateSetting', () => {
    it('atualiza o valor e devolve a linha atualizada', async () => {
      await createSetting({ value: '24' });
      const updated = await updateSetting('wms.task_delay_threshold_hours', '48', 'user-1');
      expect(updated.value).toBe('48');
    });

    it('rejeita valor incompatível com o type, sem alterar o banco', async () => {
      await createSetting({ value: '24' });
      await expect(
        updateSetting('wms.task_delay_threshold_hours', 'abc', 'user-1')
      ).rejects.toThrow(AppError);

      const row = await testPrisma.systemSetting.findUnique({
        where: { key: 'wms.task_delay_threshold_hours' },
      });
      expect(row!.value).toBe('24');
    });

    it('rejeita chave inexistente com 404', async () => {
      await expect(updateSetting('chave.inexistente', '1', 'user-1')).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('rejeita valor fora da lista permitida para uma chave com enum conhecido (audit.mode)', async () => {
      await createSetting({
        key: 'audit.mode',
        value: 'write_only',
        type: 'STRING',
        category: 'auditoria',
        label: 'Modo de auditoria',
      });

      await expect(
        updateSetting('audit.mode', 'qualquer_coisa', 'user-1')
      ).rejects.toThrow(AppError);

      const row = await testPrisma.systemSetting.findUnique({ where: { key: 'audit.mode' } });
      expect(row!.value).toBe('write_only');
    });

    it('aceita valor dentro da lista permitida para audit.mode', async () => {
      await createSetting({
        key: 'audit.mode',
        value: 'write_only',
        type: 'STRING',
        category: 'auditoria',
        label: 'Modo de auditoria',
      });

      const updated = await updateSetting('audit.mode', 'errors_only', 'user-1');
      expect(updated.value).toBe('errors_only');
    });

    it('invalida o cache imediatamente — uma leitura logo após reflete o novo valor', async () => {
      await createSetting({ value: '24' });
      expect(await getSetting('wms.task_delay_threshold_hours', 0)).toBe(24);

      await updateSetting('wms.task_delay_threshold_hours', '99', 'user-1');

      expect(await getSetting('wms.task_delay_threshold_hours', 0)).toBe(99);
    });

    it('rejeita audit.retention_days = 0 com 400, sem alterar o banco', async () => {
      await createSetting({
        key: 'audit.retention_days',
        value: '90',
        type: 'NUMBER',
        category: 'auditoria',
        label: 'Retenção de logs de auditoria (dias)',
      });

      await expect(
        updateSetting('audit.retention_days', '0', 'user-1')
      ).rejects.toMatchObject({ statusCode: 400 });

      const row = await testPrisma.systemSetting.findUnique({ where: { key: 'audit.retention_days' } });
      expect(row!.value).toBe('90');
    });

    it('rejeita rate_limit.general.max_requests = 0 com 400', async () => {
      await createSetting({
        key: 'rate_limit.general.max_requests',
        value: '100',
        type: 'NUMBER',
        category: 'rate_limit',
        label: 'Máximo de requisições no limite geral',
      });

      await expect(
        updateSetting('rate_limit.general.max_requests', '0', 'user-1')
      ).rejects.toMatchObject({ statusCode: 400 });

      const row = await testPrisma.systemSetting.findUnique({ where: { key: 'rate_limit.general.max_requests' } });
      expect(row!.value).toBe('100');
    });

    it('aceita valor exatamente no mínimo permitido (audit.retention_days = 1)', async () => {
      await createSetting({
        key: 'audit.retention_days',
        value: '90',
        type: 'NUMBER',
        category: 'auditoria',
        label: 'Retenção de logs de auditoria (dias)',
      });

      const updated = await updateSetting('audit.retention_days', '1', 'user-1');
      expect(updated.value).toBe('1');
    });
  });

  describe('race de invalidação de cache (epoch guard)', () => {
    it('não deixa um load em voo sobrescrever o cache com um snapshot pré-escrita', async () => {
      await createSetting({ value: '24' });

      // Popula o cache normalmente, depois zera para forçar um novo load.
      expect(await getSetting('wms.task_delay_threshold_hours', 0)).toBe(24);
      clearSettingCache();

      // Controla manualmente quando o findMany do load "em voo" resolve.
      let resolveFindMany!: (rows: any[]) => void;
      const findManySpy = jest.spyOn(prisma.systemSetting, 'findMany').mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFindMany = resolve;
          }) as any
      );

      // Dispara a leitura que vai ficar "presa" aguardando o findMany acima —
      // essa é a leitura A do cenário descrito no achado 2.
      const staleRead = getSetting('wms.task_delay_threshold_hours', 0);

      // Enquanto a leitura A ainda está em voo, um PATCH concorrente grava um
      // valor novo e invalida o cache (clearSettingCache real, chamado por
      // updateSetting).
      findManySpy.mockRestore();
      await updateSetting('wms.task_delay_threshold_hours', '99', 'user-1');

      // Agora deixa a leitura A resolver com o snapshot PRÉ-escrita (valor 24).
      resolveFindMany([
        {
          key: 'wms.task_delay_threshold_hours',
          value: '24',
          type: 'NUMBER',
          category: 'wms',
          label: 'Limiar de tarefa atrasada (horas)',
          description: null,
          updatedAt: new Date(),
          updatedBy: null,
        },
      ]);
      expect(await staleRead).toBe(24); // a leitura A em si devolve o snapshot que buscou — comportamento esperado.

      // O que importa: uma leitura SUBSEQUENTE não pode herdar o snapshot
      // stale que a leitura A tentou gravar no cache — sem o epoch guard,
      // `load()` teria feito `cache = loaded` incondicionalmente e essa
      // leitura devolveria 24 em vez de 99.
      expect(await getSetting('wms.task_delay_threshold_hours', 0)).toBe(99);
    });
  });
});
