import { cleanDatabase, disconnectTestDb, testPrisma } from '../helpers/db';
import { createTestWorkCenter, setTestLicensedModule } from '../helpers/fixtures';
import { clearLicensedModuleCache } from '../../src/services/licensed-module.service';
import equipmentService from '../../src/services/equipment.service';
import maintenancePlanService from '../../src/services/maintenance-plan.service';
import maintenanceOrderService from '../../src/services/maintenance-order.service';
import maintenanceJob from '../../src/jobs/maintenance.job';

const DAY = 24 * 60 * 60 * 1000;

describe('MaintenanceJob', () => {
  // `run()` é fail-closed por licença ANTES de gerar preventivas ou detectar
  // atraso (mesmo padrão dos jobs WMS) — a tabela `licensed_modules` começa
  // vazia no banco de teste (nenhuma migração insere dado) e é truncada pelo
  // `cleanDatabase()` do teste anterior, então precisa ser religada aqui.
  beforeEach(async () => {
    clearLicensedModuleCache();
    await setTestLicensedModule('MANUTENCAO', true);
    clearLicensedModuleCache();
  });

  afterEach(async () => {
    await cleanDatabase();
    clearLicensedModuleCache();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  const createEquipment = async () => {
    const workCenter = await createTestWorkCenter();
    return equipmentService.create({ code: 'EQP-JOB', name: 'Equipamento Job', workCenterId: workCenter.id });
  };

  it('gera uma ordem preventiva para plano vencido e avança nextDueDate a partir do valor anterior', async () => {
    const equipment = await createEquipment();
    const plan = await maintenancePlanService.create({
      equipmentId: equipment.id,
      name: 'Plano vencido',
      frequencyDays: 10,
      nextDueDate: new Date(Date.now() - 2 * DAY), // venceu há 2 dias
    });
    const originalNextDueDate = plan.nextDueDate;

    await maintenanceJob.runManually();

    const orders = await testPrisma.maintenanceOrder.findMany({ where: { planId: plan.id } });
    expect(orders).toHaveLength(1);
    expect(orders[0].type).toBe('PREVENTIVE');
    expect(orders[0].status).toBe('PENDING');

    const updatedPlan = await testPrisma.maintenancePlan.findUnique({ where: { id: plan.id } });
    // Avançou a partir do nextDueDate ANTERIOR (não de agora): originalNextDueDate + 10 dias.
    expect(updatedPlan!.nextDueDate.getTime()).toBe(originalNextDueDate.getTime() + 10 * DAY);
  });

  it('não duplica ordem quando já existe uma PENDING aberta para o plano', async () => {
    const equipment = await createEquipment();
    const plan = await maintenancePlanService.create({
      equipmentId: equipment.id,
      name: 'Plano com ordem aberta',
      frequencyDays: 10,
      nextDueDate: new Date(Date.now() - 1 * DAY),
    });
    await maintenanceOrderService.createPreventiveFromPlan(plan.id);

    await maintenanceJob.runManually();

    const orders = await testPrisma.maintenanceOrder.findMany({ where: { planId: plan.id } });
    expect(orders).toHaveLength(1); // continua só a que já existia
  });

  it('não gera ordem para plano inativo, mesmo vencido', async () => {
    const equipment = await createEquipment();
    const plan = await maintenancePlanService.create({
      equipmentId: equipment.id,
      name: 'Plano inativo',
      frequencyDays: 10,
      nextDueDate: new Date(Date.now() - 1 * DAY),
      active: false,
    });

    await maintenanceJob.runManually();

    const orders = await testPrisma.maintenanceOrder.findMany({ where: { planId: plan.id } });
    expect(orders).toHaveLength(0);
  });

  it('não gera ordem para plano ainda não vencido', async () => {
    const equipment = await createEquipment();
    const plan = await maintenancePlanService.create({
      equipmentId: equipment.id,
      name: 'Plano futuro',
      frequencyDays: 10,
      nextDueDate: new Date(Date.now() + 5 * DAY),
    });

    await maintenanceJob.runManually();

    const orders = await testPrisma.maintenanceOrder.findMany({ where: { planId: plan.id } });
    expect(orders).toHaveLength(0);
  });
});
