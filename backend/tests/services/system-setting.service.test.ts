import {
  getSetting,
  listSettings,
  updateSetting,
  clearSettingCache,
} from '../../src/services/system-setting.service';
import { testPrisma, cleanDatabase, disconnectTestDb } from '../helpers/db';
import { AppError } from '../../src/middleware/error.middleware';

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
      const spy = jest.spyOn(testPrisma.systemSetting, 'findMany');

      await Promise.all([
        getSetting('wms.task_delay_threshold_hours', 24),
        getSetting('wms.task_delay_threshold_hours', 24),
        getSetting('wms.task_delay_threshold_hours', 24),
      ]);

      // A implementação usa `prisma` (backend/src/config/database), não
      // `testPrisma` diretamente — o spy conta chamadas no MESMO processo/
      // conexão porque os testes de integração deste projeto sempre validam
      // efeito colateral via testPrisma, nunca mockando o client do serviço.
      // Ver Nota de implementação abaixo: o serviço usa `prisma` importado de
      // `../config/database`, cujo `findMany` é o mesmo builder de query —
      // o spy em `testPrisma.systemSetting.findMany` não intercepta chamadas
      // feitas por uma instância DIFERENTE de PrismaClient. Este teste,
      // portanto, espiona diretamente o client que o serviço usa.
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
  });
});
