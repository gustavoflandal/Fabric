import { cleanDatabase, disconnectTestDb } from '../helpers/db';
import { createTestWorkCenter, createTestUser } from '../helpers/fixtures';
import equipmentService from '../../src/services/equipment.service';
import maintenancePlanService from '../../src/services/maintenance-plan.service';
import maintenanceOrderService from '../../src/services/maintenance-order.service';

describe('MaintenanceOrderService', () => {
  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  const createEquipment = async () => {
    const workCenter = await createTestWorkCenter();
    return equipmentService.create({ code: 'EQP-ORD', name: 'Equipamento Teste', workCenterId: workCenter.id });
  };

  describe('createCorrective', () => {
    it('cria uma ordem corretiva PENDING, sem planId', async () => {
      const equipment = await createEquipment();

      const order = await maintenanceOrderService.createCorrective({
        equipmentId: equipment.id,
        problemDescription: 'Ruído anormal no motor',
      });

      expect(order.type).toBe('CORRECTIVE');
      expect(order.status).toBe('PENDING');
      expect(order.planId).toBeNull();
    });

    it('rejeita criar corretiva com equipmentId inexistente', async () => {
      await expect(
        maintenanceOrderService.createCorrective({
          equipmentId: 'id-inexistente',
          problemDescription: 'X',
        })
      ).rejects.toThrow('Equipamento informado não existe');
    });
  });

  describe('createPreventiveFromPlan', () => {
    it('cria uma ordem preventiva PENDING vinculada ao plano', async () => {
      const equipment = await createEquipment();
      const plan = await maintenancePlanService.create({
        equipmentId: equipment.id,
        name: 'Lubrificação',
        frequencyDays: 30,
      });

      const order = await maintenanceOrderService.createPreventiveFromPlan(plan.id);

      expect(order.type).toBe('PREVENTIVE');
      expect(order.status).toBe('PENDING');
      expect(order.planId).toBe(plan.id);
      expect(order.equipmentId).toBe(equipment.id);
    });
  });

  describe('hasOpenOrderForPlan', () => {
    it('retorna true com ordem PENDING/IN_PROGRESS aberta, false após concluída', async () => {
      const equipment = await createEquipment();
      const plan = await maintenancePlanService.create({
        equipmentId: equipment.id,
        name: 'Inspeção',
        frequencyDays: 15,
      });
      const order = await maintenanceOrderService.createPreventiveFromPlan(plan.id);

      expect(await maintenanceOrderService.hasOpenOrderForPlan(plan.id)).toBe(true);

      await maintenanceOrderService.start(order.id);
      expect(await maintenanceOrderService.hasOpenOrderForPlan(plan.id)).toBe(true);

      await maintenanceOrderService.complete(order.id, 'Feito');
      expect(await maintenanceOrderService.hasOpenOrderForPlan(plan.id)).toBe(false);
    });
  });

  describe('transições de status', () => {
    it('start: PENDING -> IN_PROGRESS com startedAt preenchido', async () => {
      const equipment = await createEquipment();
      const order = await maintenanceOrderService.createCorrective({
        equipmentId: equipment.id,
        problemDescription: 'Vazamento',
      });

      const started = await maintenanceOrderService.start(order.id);

      expect(started.status).toBe('IN_PROGRESS');
      expect(started.startedAt).not.toBeNull();
    });

    it('rejeita start de uma ordem que não está PENDING', async () => {
      const equipment = await createEquipment();
      const order = await maintenanceOrderService.createCorrective({
        equipmentId: equipment.id,
        problemDescription: 'X',
      });
      await maintenanceOrderService.start(order.id);

      await expect(maintenanceOrderService.start(order.id)).rejects.toThrow('Ordem não está pendente');
    });

    it('complete: IN_PROGRESS -> COMPLETED com completedAt e resolutionNotes', async () => {
      const equipment = await createEquipment();
      const order = await maintenanceOrderService.createCorrective({
        equipmentId: equipment.id,
        problemDescription: 'Correia partida',
      });
      await maintenanceOrderService.start(order.id);

      const completed = await maintenanceOrderService.complete(order.id, 'Correia trocada');

      expect(completed.status).toBe('COMPLETED');
      expect(completed.completedAt).not.toBeNull();
      expect(completed.resolutionNotes).toBe('Correia trocada');
    });

    it('rejeita complete de uma ordem PENDING (precisa estar IN_PROGRESS)', async () => {
      const equipment = await createEquipment();
      const order = await maintenanceOrderService.createCorrective({
        equipmentId: equipment.id,
        problemDescription: 'X',
      });

      await expect(maintenanceOrderService.complete(order.id, 'Y')).rejects.toThrow(
        'Ordem não está em execução'
      );
    });

    it('cancel: permitido a partir de PENDING e de IN_PROGRESS', async () => {
      const equipment = await createEquipment();
      const orderA = await maintenanceOrderService.createCorrective({
        equipmentId: equipment.id,
        problemDescription: 'A',
      });
      const cancelledA = await maintenanceOrderService.cancel(orderA.id, 'Falso alarme');
      expect(cancelledA.status).toBe('CANCELLED');

      const orderB = await maintenanceOrderService.createCorrective({
        equipmentId: equipment.id,
        problemDescription: 'B',
      });
      await maintenanceOrderService.start(orderB.id);
      const cancelledB = await maintenanceOrderService.cancel(orderB.id);
      expect(cancelledB.status).toBe('CANCELLED');
    });

    it('rejeita cancel de uma ordem já COMPLETED', async () => {
      const equipment = await createEquipment();
      const order = await maintenanceOrderService.createCorrective({
        equipmentId: equipment.id,
        problemDescription: 'X',
      });
      await maintenanceOrderService.start(order.id);
      await maintenanceOrderService.complete(order.id, 'Feito');

      await expect(maintenanceOrderService.cancel(order.id)).rejects.toThrow(
        'Ordem não pode ser cancelada'
      );
    });
  });

  describe('updateAssignee', () => {
    it('atribui e depois desatribui (null) sem exigir transição de status', async () => {
      const equipment = await createEquipment();
      const user = await createTestUser();
      const order = await maintenanceOrderService.createCorrective({
        equipmentId: equipment.id,
        problemDescription: 'X',
      });

      const assigned = await maintenanceOrderService.updateAssignee(order.id, user.id);
      expect(assigned.assignedTo).toBe(user.id);
      expect(assigned.status).toBe('PENDING'); // status não muda

      const unassigned = await maintenanceOrderService.updateAssignee(order.id, null);
      expect(unassigned.assignedTo).toBeNull();
    });
  });
});
