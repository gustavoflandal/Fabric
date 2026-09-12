import { cleanDatabase, disconnectTestDb, testPrisma } from '../helpers/db';
import { createTestSupplier, createTestManager, createTestPositions } from '../helpers/fixtures';
import yardVisitService from '../../src/services/yard-visit.service';
import driverService from '../../src/services/driver.service';
import vehicleService from '../../src/services/vehicle.service';

async function createTestPurchaseOrderMinimal(supplierId: string, expectedDate: Date) {
  const manager = await createTestManager();
  let counter = Math.floor(Math.random() * 1000000);
  return testPrisma.purchaseOrder.create({
    data: {
      orderNumber: `PO-YV-${counter}`,
      supplierId,
      expectedDate,
      totalValue: 0,
      createdBy: manager.id,
    },
  });
}

describe('YardVisitService', () => {
  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('cria um agendamento manual sem vínculo com PurchaseOrder', async () => {
    const { warehouse } = await createTestPositions(1, { positionType: 'DOCA' });
    const supplier = await createTestSupplier();

    const visit = await yardVisitService.create({
      warehouseId: warehouse.id,
      serviceType: 'EXPEDICAO',
      supplierId: supplier.id,
      scheduledAt: new Date(Date.now() + 3600_000),
    });

    expect(visit.status).toBe('SCHEDULED');
    expect(visit.purchaseOrderId).toBeNull();
  });

  it('cria um agendamento de Recebimento pré-preenchido a partir de um PurchaseOrder', async () => {
    const { warehouse } = await createTestPositions(1, { positionType: 'DOCA' });
    const supplier = await createTestSupplier();
    const expectedDate = new Date(Date.now() + 7200_000);
    const po = await createTestPurchaseOrderMinimal(supplier.id, expectedDate);

    const visit = await yardVisitService.create({
      warehouseId: warehouse.id,
      serviceType: 'RECEBIMENTO',
      purchaseOrderId: po.id,
      scheduledAt: expectedDate,
    });

    expect(visit.purchaseOrderId).toBe(po.id);
    expect(visit.supplierId).toBe(supplier.id);
  });

  it('cria um walk-in (check-in direto) já com motorista e veículo, em status CHECKED_IN', async () => {
    const { warehouse } = await createTestPositions(1, { positionType: 'DOCA' });
    const supplier = await createTestSupplier();
    const driver = await driverService.create({ name: 'Motorista Walk-in', cpf: '10101010101', supplierId: supplier.id });
    const vehicle = await vehicleService.create({ plate: 'ABC1234', type: 'TRUCK', supplierId: supplier.id });

    const visit = await yardVisitService.create({
      warehouseId: warehouse.id,
      serviceType: 'EXPEDICAO',
      supplierId: supplier.id,
      scheduledAt: new Date(),
      driverId: driver.id,
      vehicleId: vehicle.id,
    });

    expect(visit.status).toBe('CHECKED_IN');
    expect(visit.checkedInAt).not.toBeNull();
  });

  describe('checkIn — pontualidade', () => {
    it('calcula NO_HORARIO quando o check-in acontece dentro da tolerância', async () => {
      const { warehouse } = await createTestPositions(1, { positionType: 'DOCA' });
      await testPrisma.yardWarehouseParams.create({ data: { warehouseId: warehouse.id, useYard: true, delayToleranceMinutes: 15 } });
      const supplier = await createTestSupplier();
      const driver = await driverService.create({ name: 'M1', cpf: '20202020202', supplierId: supplier.id });
      const vehicle = await vehicleService.create({ plate: 'ABC2222', type: 'TRUCK', supplierId: supplier.id });
      const visit = await yardVisitService.create({
        warehouseId: warehouse.id,
        serviceType: 'RECEBIMENTO',
        supplierId: supplier.id,
        scheduledAt: new Date(),
      });

      const result = await yardVisitService.checkIn(visit.id, { driverId: driver.id, vehicleId: vehicle.id });

      expect(result.punctuality).toBe('NO_HORARIO');
    });

    it('calcula ATRASADO quando o check-in acontece depois da tolerância', async () => {
      const { warehouse } = await createTestPositions(1, { positionType: 'DOCA' });
      await testPrisma.yardWarehouseParams.create({ data: { warehouseId: warehouse.id, useYard: true, delayToleranceMinutes: 10 } });
      const supplier = await createTestSupplier();
      const driver = await driverService.create({ name: 'M2', cpf: '30303030303', supplierId: supplier.id });
      const vehicle = await vehicleService.create({ plate: 'ABC3333', type: 'TRUCK', supplierId: supplier.id });
      const scheduledAt = new Date(Date.now() - 30 * 60_000); // agendado há 30 minutos
      const visit = await yardVisitService.create({
        warehouseId: warehouse.id,
        serviceType: 'RECEBIMENTO',
        supplierId: supplier.id,
        scheduledAt,
      });

      const result = await yardVisitService.checkIn(visit.id, { driverId: driver.id, vehicleId: vehicle.id });

      expect(result.punctuality).toBe('ATRASADO');
    });

    it('calcula ANTECIPADO quando o check-in acontece bem antes do agendado', async () => {
      const { warehouse } = await createTestPositions(1, { positionType: 'DOCA' });
      await testPrisma.yardWarehouseParams.create({ data: { warehouseId: warehouse.id, useYard: true, delayToleranceMinutes: 10 } });
      const supplier = await createTestSupplier();
      const driver = await driverService.create({ name: 'M3', cpf: '40404040404', supplierId: supplier.id });
      const vehicle = await vehicleService.create({ plate: 'ABC4444', type: 'TRUCK', supplierId: supplier.id });
      const scheduledAt = new Date(Date.now() + 30 * 60_000); // agendado pra daqui 30 minutos
      const visit = await yardVisitService.create({
        warehouseId: warehouse.id,
        serviceType: 'RECEBIMENTO',
        supplierId: supplier.id,
        scheduledAt,
      });

      const result = await yardVisitService.checkIn(visit.id, { driverId: driver.id, vehicleId: vehicle.id });

      expect(result.punctuality).toBe('ANTECIPADO');
    });
  });

  describe('checkIn — validações críticas', () => {
    it('rejeita check-in com motorista bloqueado', async () => {
      const { warehouse } = await createTestPositions(1, { positionType: 'DOCA' });
      const supplier = await createTestSupplier();
      const driver = await driverService.create({ name: 'Bloqueado', cpf: '50505050505', supplierId: supplier.id });
      await driverService.setBlocked(driver.id, true, 'CNH vencida');
      const vehicle = await vehicleService.create({ plate: 'ABC5555', type: 'TRUCK', supplierId: supplier.id });
      const visit = await yardVisitService.create({
        warehouseId: warehouse.id,
        serviceType: 'RECEBIMENTO',
        supplierId: supplier.id,
        scheduledAt: new Date(),
      });

      await expect(yardVisitService.checkIn(visit.id, { driverId: driver.id, vehicleId: vehicle.id })).rejects.toThrow(
        'Motorista está bloqueado'
      );
    });

    it('rejeita check-in com veículo bloqueado', async () => {
      const { warehouse } = await createTestPositions(1, { positionType: 'DOCA' });
      const supplier = await createTestSupplier();
      const driver = await driverService.create({ name: 'D1', cpf: '60606060606', supplierId: supplier.id });
      const vehicle = await vehicleService.create({ plate: 'ABC6666', type: 'TRUCK', supplierId: supplier.id });
      await vehicleService.setBlocked(vehicle.id, true, 'Documentação vencida');
      const visit = await yardVisitService.create({
        warehouseId: warehouse.id,
        serviceType: 'RECEBIMENTO',
        supplierId: supplier.id,
        scheduledAt: new Date(),
      });

      await expect(yardVisitService.checkIn(visit.id, { driverId: driver.id, vehicleId: vehicle.id })).rejects.toThrow(
        'Veículo está bloqueado'
      );
    });

    it('rejeita check-in de um veículo que já tem outra visita ativa (CHECKED_IN)', async () => {
      const { warehouse } = await createTestPositions(1, { positionType: 'DOCA' });
      const supplier = await createTestSupplier();
      const driver1 = await driverService.create({ name: 'D2', cpf: '70707070707', supplierId: supplier.id });
      const driver2 = await driverService.create({ name: 'D3', cpf: '70707070708', supplierId: supplier.id });
      const vehicle = await vehicleService.create({ plate: 'ABC7777', type: 'TRUCK', supplierId: supplier.id });
      const visit1 = await yardVisitService.create({
        warehouseId: warehouse.id, serviceType: 'RECEBIMENTO', supplierId: supplier.id, scheduledAt: new Date(),
      });
      await yardVisitService.checkIn(visit1.id, { driverId: driver1.id, vehicleId: vehicle.id });
      const visit2 = await yardVisitService.create({
        warehouseId: warehouse.id, serviceType: 'RECEBIMENTO', supplierId: supplier.id, scheduledAt: new Date(),
      });

      await expect(yardVisitService.checkIn(visit2.id, { driverId: driver2.id, vehicleId: vehicle.id })).rejects.toThrow(
        'Este veículo já possui uma visita ativa no pátio'
      );
    });

    it('rejeita check-in quando motorista pertence a um fornecedor diferente da visita', async () => {
      const { warehouse } = await createTestPositions(1, { positionType: 'DOCA' });
      const supplier1 = await createTestSupplier();
      const supplier2 = await createTestSupplier();
      const driver = await driverService.create({ name: 'D4', cpf: '80808080808', supplierId: supplier2.id });
      const vehicle = await vehicleService.create({ plate: 'ABC8888', type: 'TRUCK', supplierId: supplier1.id });
      const visit = await yardVisitService.create({
        warehouseId: warehouse.id, serviceType: 'RECEBIMENTO', supplierId: supplier1.id, scheduledAt: new Date(),
      });

      await expect(yardVisitService.checkIn(visit.id, { driverId: driver.id, vehicleId: vehicle.id })).rejects.toThrow(
        'Motorista ou veículo pertencem a um fornecedor diferente do agendamento'
      );
    });
  });

  describe('delete e cancel', () => {
    it('permite excluir um agendamento em SCHEDULED', async () => {
      const { warehouse } = await createTestPositions(1, { positionType: 'DOCA' });
      const supplier = await createTestSupplier();
      const visit = await yardVisitService.create({
        warehouseId: warehouse.id, serviceType: 'RECEBIMENTO', supplierId: supplier.id, scheduledAt: new Date(),
      });

      await expect(yardVisitService.delete(visit.id)).resolves.toBeDefined();
    });

    it('rejeita excluir uma visita já em CHECKED_IN', async () => {
      const { warehouse } = await createTestPositions(1, { positionType: 'DOCA' });
      const supplier = await createTestSupplier();
      const driver = await driverService.create({ name: 'D5', cpf: '90909090909', supplierId: supplier.id });
      const vehicle = await vehicleService.create({ plate: 'ABC9999', type: 'TRUCK', supplierId: supplier.id });
      const visit = await yardVisitService.create({
        warehouseId: warehouse.id, serviceType: 'RECEBIMENTO', supplierId: supplier.id, scheduledAt: new Date(),
      });
      await yardVisitService.checkIn(visit.id, { driverId: driver.id, vehicleId: vehicle.id });

      await expect(yardVisitService.delete(visit.id)).rejects.toThrow(
        'Só é possível excluir agendamentos que ainda não fizeram check-in'
      );
    });

    it('cancela uma visita já com check-in, sem apagar o registro', async () => {
      const { warehouse } = await createTestPositions(1, { positionType: 'DOCA' });
      const supplier = await createTestSupplier();
      const driver = await driverService.create({ name: 'D6', cpf: '11122233344', supplierId: supplier.id });
      const vehicle = await vehicleService.create({ plate: 'ABC1010', type: 'TRUCK', supplierId: supplier.id });
      const visit = await yardVisitService.create({
        warehouseId: warehouse.id, serviceType: 'RECEBIMENTO', supplierId: supplier.id, scheduledAt: new Date(),
      });
      await yardVisitService.checkIn(visit.id, { driverId: driver.id, vehicleId: vehicle.id });

      const cancelled = await yardVisitService.cancel(visit.id);

      expect(cancelled.status).toBe('CANCELLED');
      const stillExists = await testPrisma.yardVisit.findUnique({ where: { id: visit.id } });
      expect(stillExists).not.toBeNull();
    });
  });

  describe('update', () => {
    it('re-deriva supplierId a partir do novo purchaseOrderId ao atualizar a visita', async () => {
      const { warehouse } = await createTestPositions(1, { positionType: 'DOCA' });
      const supplierA = await createTestSupplier();
      const supplierB = await createTestSupplier();
      const expectedDate = new Date(Date.now() + 7200_000);
      const poA = await createTestPurchaseOrderMinimal(supplierA.id, expectedDate);
      const poB = await createTestPurchaseOrderMinimal(supplierB.id, expectedDate);
      const visit = await yardVisitService.create({
        warehouseId: warehouse.id,
        serviceType: 'RECEBIMENTO',
        purchaseOrderId: poA.id,
        scheduledAt: expectedDate,
      });
      expect(visit.supplierId).toBe(supplierA.id);

      const updated = await yardVisitService.update(visit.id, { purchaseOrderId: poB.id });

      expect(updated.purchaseOrderId).toBe(poB.id);
      expect(updated.supplierId).toBe(supplierB.id);
    });
  });

  it('lista visitas filtrando por armazém e status', async () => {
    const { warehouse: wh1 } = await createTestPositions(1, { positionType: 'DOCA' });
    const { warehouse: wh2 } = await createTestPositions(1, { positionType: 'DOCA' });
    const supplier = await createTestSupplier();
    await yardVisitService.create({ warehouseId: wh1.id, serviceType: 'RECEBIMENTO', supplierId: supplier.id, scheduledAt: new Date() });
    await yardVisitService.create({ warehouseId: wh2.id, serviceType: 'RECEBIMENTO', supplierId: supplier.id, scheduledAt: new Date() });

    const result = await yardVisitService.getAll(1, 100, { warehouseId: wh1.id });

    expect(result.data).toHaveLength(1);
  });
});
