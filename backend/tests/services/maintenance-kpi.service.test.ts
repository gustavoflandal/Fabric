import { cleanDatabase, disconnectTestDb, testPrisma } from '../helpers/db';
import { createTestWorkCenter } from '../helpers/fixtures';
import equipmentService from '../../src/services/equipment.service';
import maintenancePlanService from '../../src/services/maintenance-plan.service';
import { getMaintenanceKpis } from '../../src/services/maintenance-kpi.service';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe('maintenance-kpi.service', () => {
  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  const createEquipment = async (code = 'EQP-KPI') => {
    const workCenter = await createTestWorkCenter();
    return equipmentService.create({ code, name: `Equipamento ${code}`, workCenterId: workCenter.id });
  };

  describe('mttrHours', () => {
    it('retorna null quando não há nenhuma ordem COMPLETED', async () => {
      await createEquipment();
      const kpis = await getMaintenanceKpis();
      expect(kpis.mttrHours).toBeNull();
    });

    it('calcula a média de completedAt-startedAt entre ordens COMPLETED', async () => {
      const equipment = await createEquipment();
      const now = Date.now();
      // Ordem 1: 2h de reparo. Ordem 2: 4h de reparo. Média = 3h.
      await testPrisma.maintenanceOrder.create({
        data: {
          equipmentId: equipment.id,
          type: 'CORRECTIVE',
          status: 'COMPLETED',
          startedAt: new Date(now - 10 * HOUR),
          completedAt: new Date(now - 8 * HOUR),
        },
      });
      await testPrisma.maintenanceOrder.create({
        data: {
          equipmentId: equipment.id,
          type: 'CORRECTIVE',
          status: 'COMPLETED',
          startedAt: new Date(now - 20 * HOUR),
          completedAt: new Date(now - 16 * HOUR),
        },
      });

      const kpis = await getMaintenanceKpis();
      expect(kpis.mttrHours).toBe(3);
    });
  });

  describe('mtbfByEquipment', () => {
    it('retorna mtbfHours null para equipamento com menos de 2 corretivas', async () => {
      const equipment = await createEquipment();
      await testPrisma.maintenanceOrder.create({
        data: { equipmentId: equipment.id, type: 'CORRECTIVE', status: 'COMPLETED' },
      });

      const kpis = await getMaintenanceKpis();
      const entry = kpis.mtbfByEquipment.find((e) => e.equipmentId === equipment.id);
      expect(entry!.mtbfHours).toBeNull();
    });

    it('calcula a média dos intervalos entre corretivas consecutivas', async () => {
      const equipment = await createEquipment();
      const now = Date.now();
      // 3 corretivas: gaps de 48h e 96h entre elas -> média 72h.
      await testPrisma.maintenanceOrder.create({
        data: {
          equipmentId: equipment.id,
          type: 'CORRECTIVE',
          status: 'COMPLETED',
          createdAt: new Date(now - 10 * DAY),
        },
      });
      await testPrisma.maintenanceOrder.create({
        data: {
          equipmentId: equipment.id,
          type: 'CORRECTIVE',
          status: 'COMPLETED',
          createdAt: new Date(now - 8 * DAY), // 48h depois da primeira
        },
      });
      await testPrisma.maintenanceOrder.create({
        data: {
          equipmentId: equipment.id,
          type: 'CORRECTIVE',
          status: 'COMPLETED',
          createdAt: new Date(now - 4 * DAY), // 96h depois da segunda
        },
      });

      const kpis = await getMaintenanceKpis();
      const entry = kpis.mtbfByEquipment.find((e) => e.equipmentId === equipment.id);
      expect(entry!.mtbfHours).toBe(72);
    });

    it('ignora ordens PREVENTIVE no cálculo de MTBF', async () => {
      const equipment = await createEquipment();
      await testPrisma.maintenanceOrder.create({
        data: { equipmentId: equipment.id, type: 'PREVENTIVE', status: 'COMPLETED' },
      });
      await testPrisma.maintenanceOrder.create({
        data: { equipmentId: equipment.id, type: 'PREVENTIVE', status: 'COMPLETED' },
      });

      const kpis = await getMaintenanceKpis();
      const entry = kpis.mtbfByEquipment.find((e) => e.equipmentId === equipment.id);
      expect(entry!.mtbfHours).toBeNull();
    });
  });

  describe('preventiveComplianceRate', () => {
    it('retorna 100 quando não há nenhum plano ativo', async () => {
      const kpis = await getMaintenanceKpis();
      expect(kpis.preventiveComplianceRate).toBe(100);
    });

    it('calcula a % de planos ativos com nextDueDate no futuro', async () => {
      const equipment = await createEquipment();
      await maintenancePlanService.create({
        equipmentId: equipment.id,
        name: 'Em dia',
        frequencyDays: 30,
        nextDueDate: new Date(Date.now() + 10 * DAY),
      });
      await maintenancePlanService.create({
        equipmentId: equipment.id,
        name: 'Atrasado',
        frequencyDays: 30,
        nextDueDate: new Date(Date.now() - 1 * DAY),
      });

      const kpis = await getMaintenanceKpis();
      expect(kpis.preventiveComplianceRate).toBe(50);
    });
  });

  describe('ordersByStatusAndType', () => {
    it('agrupa contagem por status e tipo', async () => {
      const equipment = await createEquipment();
      await testPrisma.maintenanceOrder.create({
        data: { equipmentId: equipment.id, type: 'CORRECTIVE', status: 'PENDING' },
      });
      await testPrisma.maintenanceOrder.create({
        data: { equipmentId: equipment.id, type: 'CORRECTIVE', status: 'PENDING' },
      });
      await testPrisma.maintenanceOrder.create({
        data: { equipmentId: equipment.id, type: 'PREVENTIVE', status: 'COMPLETED' },
      });

      const kpis = await getMaintenanceKpis();
      const pendingCorrective = kpis.ordersByStatusAndType.find(
        (e) => e.status === 'PENDING' && e.type === 'CORRECTIVE'
      );
      const completedPreventive = kpis.ordersByStatusAndType.find(
        (e) => e.status === 'COMPLETED' && e.type === 'PREVENTIVE'
      );
      expect(pendingCorrective?.count).toBe(2);
      expect(completedPreventive?.count).toBe(1);
    });
  });
});
