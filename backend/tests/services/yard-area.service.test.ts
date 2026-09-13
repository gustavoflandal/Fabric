import { cleanDatabase, disconnectTestDb, testPrisma } from '../helpers/db';
import yardAreaService from '../../src/services/yard-area.service';

describe('YardAreaService', () => {
  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('cria uma área vinculada a um armazém existente', async () => {
    const warehouse = await testPrisma.warehouse.create({ data: { code: 'WH-A1', name: 'Armazém A1' } });

    const area = await yardAreaService.create({ warehouseId: warehouse.id, code: 'SETOR-A', name: 'Setor A' });

    expect(area.code).toBe('SETOR-A');
    expect(area.active).toBe(true);
  });

  it('rejeita criar área com warehouseId inexistente', async () => {
    await expect(
      yardAreaService.create({ warehouseId: 'id-que-nao-existe', code: 'SETOR-B', name: 'Setor B' })
    ).rejects.toThrow('Armazém informado não existe');
  });

  it('rejeita código de área duplicado no mesmo armazém', async () => {
    const warehouse = await testPrisma.warehouse.create({ data: { code: 'WH-A2', name: 'Armazém A2' } });
    await yardAreaService.create({ warehouseId: warehouse.id, code: 'SETOR-C', name: 'Setor C' });

    await expect(
      yardAreaService.create({ warehouseId: warehouse.id, code: 'SETOR-C', name: 'Setor C Duplicado' })
    ).rejects.toThrow('Já existe uma área com este código neste armazém');
  });

  it('bloqueia uma área com motivo', async () => {
    const warehouse = await testPrisma.warehouse.create({ data: { code: 'WH-A3', name: 'Armazém A3' } });
    const area = await yardAreaService.create({ warehouseId: warehouse.id, code: 'SETOR-D', name: 'Setor D' });

    const blocked = await yardAreaService.setBlocked(area.id, true, 'Reforma na pavimentação');

    expect(blocked.blocked).toBe(true);
    expect(blocked.blockedReason).toBe('Reforma na pavimentação');
  });

  it('lista áreas filtrando por armazém', async () => {
    const wh1 = await testPrisma.warehouse.create({ data: { code: 'WH-A4', name: 'Armazém A4' } });
    const wh2 = await testPrisma.warehouse.create({ data: { code: 'WH-A5', name: 'Armazém A5' } });
    await yardAreaService.create({ warehouseId: wh1.id, code: 'SETOR-E', name: 'Setor E' });
    await yardAreaService.create({ warehouseId: wh2.id, code: 'SETOR-F', name: 'Setor F' });

    const result = await yardAreaService.getAll(1, 100, { warehouseId: wh1.id });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].code).toBe('SETOR-E');
  });
});
