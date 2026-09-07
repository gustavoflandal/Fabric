import { cleanDatabase, disconnectTestDb } from '../helpers/db';
import { createTestWorkCenter } from '../helpers/fixtures';
import equipmentService from '../../src/services/equipment.service';
import maintenancePlanService from '../../src/services/maintenance-plan.service';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe('MaintenancePlanService', () => {
  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  const createEquipment = async () => {
    const workCenter = await createTestWorkCenter();
    return equipmentService.create({ code: 'EQP-PLAN', name: 'Equipamento Teste', workCenterId: workCenter.id });
  };

  it('calcula nextDueDate como agora + frequencyDays quando não informado', async () => {
    const equipment = await createEquipment();
    const before = Date.now();

    const plan = await maintenancePlanService.create({
      equipmentId: equipment.id,
      name: 'Troca de óleo',
      frequencyDays: 30,
    });

    const expectedMin = before + 30 * DAY - HOUR; // folga de 1h para o tempo de execução do teste
    const expectedMax = before + 30 * DAY + HOUR;
    expect(plan.nextDueDate.getTime()).toBeGreaterThan(expectedMin);
    expect(plan.nextDueDate.getTime()).toBeLessThan(expectedMax);
  });

  it('usa nextDueDate explícito quando informado', async () => {
    const equipment = await createEquipment();
    const explicitDate = new Date(Date.now() + 5 * DAY);

    const plan = await maintenancePlanService.create({
      equipmentId: equipment.id,
      name: 'Calibração',
      frequencyDays: 90,
      nextDueDate: explicitDate,
    });

    expect(plan.nextDueDate.getTime()).toBe(explicitDate.getTime());
  });

  it('rejeita criar plano com equipmentId inexistente', async () => {
    await expect(
      maintenancePlanService.create({
        equipmentId: 'id-inexistente',
        name: 'Plano X',
        frequencyDays: 15,
      })
    ).rejects.toThrow('Equipamento informado não existe');
  });

  it('lista planos ordenados por nextDueDate ascendente', async () => {
    const equipment = await createEquipment();
    await maintenancePlanService.create({
      equipmentId: equipment.id,
      name: 'Plano distante',
      frequencyDays: 90,
    });
    await maintenancePlanService.create({
      equipmentId: equipment.id,
      name: 'Plano próximo',
      frequencyDays: 5,
    });

    const result = await maintenancePlanService.getAll();

    expect(result.data[0].name).toBe('Plano próximo');
    expect(result.data[1].name).toBe('Plano distante');
  });

  it('toggleActive inverte o campo active', async () => {
    const equipment = await createEquipment();
    const plan = await maintenancePlanService.create({
      equipmentId: equipment.id,
      name: 'Plano Y',
      frequencyDays: 30,
    });

    const toggled = await maintenancePlanService.toggleActive(plan.id);
    expect(toggled.active).toBe(false);
  });
});
