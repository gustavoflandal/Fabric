import { cleanDatabase, disconnectTestDb, testPrisma } from '../helpers/db';
import { createTestWorkCenter } from '../helpers/fixtures';
import equipmentService from '../../src/services/equipment.service';

describe('EquipmentService', () => {
  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('cria um equipamento vinculado a um centro de trabalho existente', async () => {
    const workCenter = await createTestWorkCenter();

    const equipment = await equipmentService.create({
      code: 'EQP-001',
      name: 'Torno CNC 1',
      workCenterId: workCenter.id,
      manufacturer: 'Romi',
    });

    expect(equipment.code).toBe('EQP-001');
    expect(equipment.workCenterId).toBe(workCenter.id);
    expect(equipment.active).toBe(true);
  });

  it('rejeita criar equipamento com workCenterId inexistente', async () => {
    await expect(
      equipmentService.create({
        code: 'EQP-002',
        name: 'Torno CNC 2',
        workCenterId: 'id-que-nao-existe',
      })
    ).rejects.toThrow('Centro de trabalho informado não existe');
  });

  it('lista equipamentos filtrando por centro de trabalho', async () => {
    const wc1 = await createTestWorkCenter();
    const wc2 = await createTestWorkCenter();
    await equipmentService.create({ code: 'EQP-A', name: 'A', workCenterId: wc1.id });
    await equipmentService.create({ code: 'EQP-B', name: 'B', workCenterId: wc2.id });

    const result = await equipmentService.getAll(1, 100, { workCenterId: wc1.id });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].code).toBe('EQP-A');
  });

  it('toggleActive inverte o campo active', async () => {
    const workCenter = await createTestWorkCenter();
    const equipment = await equipmentService.create({
      code: 'EQP-003',
      name: 'Prensa 1',
      workCenterId: workCenter.id,
    });

    const toggled = await equipmentService.toggleActive(equipment.id);
    expect(toggled.active).toBe(false);
  });

  it('rejeita atualizar para um workCenterId inexistente', async () => {
    const workCenter = await createTestWorkCenter();
    const equipment = await equipmentService.create({
      code: 'EQP-004',
      name: 'Prensa 2',
      workCenterId: workCenter.id,
    });

    await expect(
      equipmentService.update(equipment.id, { workCenterId: 'id-invalido' })
    ).rejects.toThrow('Centro de trabalho informado não existe');
  });
});
