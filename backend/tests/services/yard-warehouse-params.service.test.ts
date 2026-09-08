import { cleanDatabase, disconnectTestDb, testPrisma } from '../helpers/db';
import yardWarehouseParamsService from '../../src/services/yard-warehouse-params.service';

describe('YardWarehouseParamsService', () => {
  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('devolve os defaults quando o armazém ainda não tem parâmetros configurados', async () => {
    const warehouse = await testPrisma.warehouse.create({ data: { code: 'WH-P1', name: 'Armazém P1' } });

    const params = await yardWarehouseParamsService.getByWarehouseId(warehouse.id);

    expect(params.useYard).toBe(true);
    expect(params.delayToleranceMinutes).toBe(15);
  });

  it('cria os parâmetros na primeira gravação (upsert)', async () => {
    const warehouse = await testPrisma.warehouse.create({ data: { code: 'WH-P2', name: 'Armazém P2' } });

    const params = await yardWarehouseParamsService.upsert(warehouse.id, {
      useYard: false,
      delayToleranceMinutes: 30,
    });

    expect(params.useYard).toBe(false);
    expect(params.delayToleranceMinutes).toBe(30);
  });

  it('atualiza os parâmetros já existentes (upsert na segunda chamada)', async () => {
    const warehouse = await testPrisma.warehouse.create({ data: { code: 'WH-P3', name: 'Armazém P3' } });
    await yardWarehouseParamsService.upsert(warehouse.id, { useYard: true, delayToleranceMinutes: 10 });

    const updated = await yardWarehouseParamsService.upsert(warehouse.id, {
      useYard: true,
      delayToleranceMinutes: 45,
    });

    expect(updated.delayToleranceMinutes).toBe(45);
    const count = await testPrisma.yardWarehouseParams.count({ where: { warehouseId: warehouse.id } });
    expect(count).toBe(1);
  });

  it('rejeita configurar parâmetros para armazém inexistente', async () => {
    await expect(
      yardWarehouseParamsService.upsert('id-que-nao-existe', { useYard: true, delayToleranceMinutes: 15 })
    ).rejects.toThrow('Armazém informado não existe');
  });

  it('rejeita tolerância de atraso fora do intervalo 0-60', async () => {
    const warehouse = await testPrisma.warehouse.create({ data: { code: 'WH-P4', name: 'Armazém P4' } });

    await expect(
      yardWarehouseParamsService.upsert(warehouse.id, { useYard: true, delayToleranceMinutes: 61 })
    ).rejects.toThrow('Tolerância de atraso deve estar entre 0 e 60 minutos');
  });
});
