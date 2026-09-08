import { cleanDatabase, disconnectTestDb, testPrisma } from '../helpers/db';
import { createTestWorkCenter } from '../helpers/fixtures';
import equipmentService from '../../src/services/equipment.service';
import maintenancePlanService from '../../src/services/maintenance-plan.service';
import maintenanceOrderService from '../../src/services/maintenance-order.service';

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

  // Fix 3 da revisão final: delete() sem guarda de dependência apagava o
  // equipamento e deixava planos/ordens de manutenção órfãos (ou corrompidos
  // por FK, dependendo do modo do banco).
  describe('delete (Fix 3: guarda de dependência)', () => {
    it('rejeita excluir equipamento com plano de manutenção vinculado', async () => {
      const workCenter = await createTestWorkCenter();
      const equipment = await equipmentService.create({
        code: 'EQP-DEL-1',
        name: 'Equipamento com plano',
        workCenterId: workCenter.id,
      });
      await maintenancePlanService.create({
        equipmentId: equipment.id,
        name: 'Plano vinculado',
        frequencyDays: 30,
      });

      await expect(equipmentService.delete(equipment.id)).rejects.toThrow(
        'Não é possível excluir um equipamento com planos ou ordens de manutenção vinculados'
      );
    });

    it('rejeita excluir equipamento com ordem de manutenção vinculada', async () => {
      const workCenter = await createTestWorkCenter();
      const equipment = await equipmentService.create({
        code: 'EQP-DEL-2',
        name: 'Equipamento com ordem',
        workCenterId: workCenter.id,
      });
      await maintenanceOrderService.createCorrective({
        equipmentId: equipment.id,
        problemDescription: 'Defeito qualquer',
      });

      await expect(equipmentService.delete(equipment.id)).rejects.toThrow(
        'Não é possível excluir um equipamento com planos ou ordens de manutenção vinculados'
      );
    });

    it('permite excluir equipamento sem planos nem ordens vinculados', async () => {
      const workCenter = await createTestWorkCenter();
      const equipment = await equipmentService.create({
        code: 'EQP-DEL-3',
        name: 'Equipamento livre',
        workCenterId: workCenter.id,
      });

      await expect(equipmentService.delete(equipment.id)).resolves.toBeDefined();
    });
  });
});
