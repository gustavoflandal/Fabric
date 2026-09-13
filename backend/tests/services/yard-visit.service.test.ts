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

  it('rejeita criar com supplierId inexistente com erro 400 claro, não 500 do Prisma', async () => {
    const { warehouse } = await createTestPositions(1, { positionType: 'DOCA' });

    await expect(
      yardVisitService.create({
        warehouseId: warehouse.id,
        serviceType: 'RECEBIMENTO',
        supplierId: '99999999-9999-9999-9999-999999999999',
        scheduledAt: new Date(Date.now() + 3600_000),
      })
    ).rejects.toThrow('Fornecedor informado não existe');
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

  describe('create — walk-in (check-in direto) bloqueado pela mesma validação de checkIn', () => {
    it('rejeita walk-in com motorista bloqueado e NÃO persiste nenhum registro', async () => {
      const { warehouse } = await createTestPositions(1, { positionType: 'DOCA' });
      const supplier = await createTestSupplier();
      const driver = await driverService.create({ name: 'Bloqueado Walk-in', cpf: '12312312312', supplierId: supplier.id });
      await driverService.setBlocked(driver.id, true, 'CNH vencida');
      const vehicle = await vehicleService.create({ plate: 'WLK1111', type: 'TRUCK', supplierId: supplier.id });

      await expect(
        yardVisitService.create({
          warehouseId: warehouse.id,
          serviceType: 'RECEBIMENTO',
          supplierId: supplier.id,
          scheduledAt: new Date(),
          driverId: driver.id,
          vehicleId: vehicle.id,
        })
      ).rejects.toThrow('Motorista está bloqueado');

      // Prova que a ordem "validar antes de inserir" foi respeitada: nenhum
      // registro deve ter sido gravado no banco pra esse walk-in reprovado.
      const persisted = await testPrisma.yardVisit.findFirst({ where: { vehicleId: vehicle.id } });
      expect(persisted).toBeNull();
      expect(await testPrisma.yardVisit.count()).toBe(0);
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

    it('rejeita editar uma visita já em CHECKED_IN — vira histórico de auditoria imutável', async () => {
      const { warehouse } = await createTestPositions(1, { positionType: 'DOCA' });
      const supplier = await createTestSupplier();
      const driver = await driverService.create({ name: 'D7', cpf: '13131313131', supplierId: supplier.id });
      const vehicle = await vehicleService.create({ plate: 'ABC1313', type: 'TRUCK', supplierId: supplier.id });
      const visit = await yardVisitService.create({
        warehouseId: warehouse.id, serviceType: 'RECEBIMENTO', supplierId: supplier.id, scheduledAt: new Date(),
      });
      await yardVisitService.checkIn(visit.id, { driverId: driver.id, vehicleId: vehicle.id });

      await expect(yardVisitService.update(visit.id, { notes: 'Tentando reescrever histórico' })).rejects.toThrow(
        'Só é possível editar agendamentos que ainda não fizeram check-in'
      );
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

  describe('allocateSpot', () => {
    it('aloca uma visita CHECKED_IN numa vaga livre, mudando o status para IN_YARD', async () => {
      const { warehouse } = await createTestPositions(1, { positionType: 'DOCA' });
      await testPrisma.yardWarehouseParams.create({ data: { warehouseId: warehouse.id, useYard: true, delayToleranceMinutes: 15 } });
      const area = await testPrisma.yardArea.create({ data: { warehouseId: warehouse.id, code: 'SETOR-X', name: 'Setor X' } });
      const spot = await testPrisma.yardSpot.create({ data: { areaId: area.id, code: 'SETOR-X-01' } });
      const supplier = await createTestSupplier();
      const driver = await driverService.create({ name: 'M-Alocacao', cpf: '12312312312', supplierId: supplier.id });
      const vehicle = await vehicleService.create({ plate: 'ALO1234', type: 'TRUCK', supplierId: supplier.id });
      const visit = await yardVisitService.create({
        warehouseId: warehouse.id, serviceType: 'RECEBIMENTO', supplierId: supplier.id, scheduledAt: new Date(),
      });
      await yardVisitService.checkIn(visit.id, { driverId: driver.id, vehicleId: vehicle.id });

      const allocated = await yardVisitService.allocateSpot(visit.id, spot.id);

      expect(allocated.status).toBe('IN_YARD');
      expect(allocated.yardSpotId).toBe(spot.id);
      // Mesma classe de achado corrigido na review final da Etapa 2 (create/update/cancel
      // devolviam registro cru): allocateSpot deve devolver enriquecido com punctuality,
      // igual checkIn() já faz, já que a UI provavelmente exibe o resultado imediatamente.
      expect(allocated.punctuality).not.toBeUndefined();
    });

    it('rejeita alocar vaga de uma visita que ainda não fez check-in (SCHEDULED)', async () => {
      const { warehouse } = await createTestPositions(1, { positionType: 'DOCA' });
      await testPrisma.yardWarehouseParams.create({ data: { warehouseId: warehouse.id, useYard: true, delayToleranceMinutes: 15 } });
      const area = await testPrisma.yardArea.create({ data: { warehouseId: warehouse.id, code: 'SETOR-Y', name: 'Setor Y' } });
      const spot = await testPrisma.yardSpot.create({ data: { areaId: area.id, code: 'SETOR-Y-01' } });
      const supplier = await createTestSupplier();
      const visit = await yardVisitService.create({
        warehouseId: warehouse.id, serviceType: 'RECEBIMENTO', supplierId: supplier.id, scheduledAt: new Date(),
      });

      await expect(yardVisitService.allocateSpot(visit.id, spot.id)).rejects.toThrow(
        'Só é possível alocar vaga para visitas que já fizeram check-in'
      );
    });

    it('rejeita alocar vaga quando o armazém não usa pátio (useYard: false)', async () => {
      const { warehouse } = await createTestPositions(1, { positionType: 'DOCA' });
      await testPrisma.yardWarehouseParams.create({ data: { warehouseId: warehouse.id, useYard: false, delayToleranceMinutes: 15 } });
      const area = await testPrisma.yardArea.create({ data: { warehouseId: warehouse.id, code: 'SETOR-Z', name: 'Setor Z' } });
      const spot = await testPrisma.yardSpot.create({ data: { areaId: area.id, code: 'SETOR-Z-01' } });
      const supplier = await createTestSupplier();
      const driver = await driverService.create({ name: 'M-SemPatio', cpf: '32132132132', supplierId: supplier.id });
      const vehicle = await vehicleService.create({ plate: 'SPT1234', type: 'TRUCK', supplierId: supplier.id });
      const visit = await yardVisitService.create({
        warehouseId: warehouse.id, serviceType: 'RECEBIMENTO', supplierId: supplier.id, scheduledAt: new Date(),
      });
      await yardVisitService.checkIn(visit.id, { driverId: driver.id, vehicleId: vehicle.id });

      await expect(yardVisitService.allocateSpot(visit.id, spot.id)).rejects.toThrow(
        'Este armazém não utiliza a etapa de pátio'
      );
    });

    it('rejeita alocar uma vaga bloqueada', async () => {
      const { warehouse } = await createTestPositions(1, { positionType: 'DOCA' });
      await testPrisma.yardWarehouseParams.create({ data: { warehouseId: warehouse.id, useYard: true, delayToleranceMinutes: 15 } });
      const area = await testPrisma.yardArea.create({ data: { warehouseId: warehouse.id, code: 'SETOR-W', name: 'Setor W' } });
      const spot = await testPrisma.yardSpot.create({ data: { areaId: area.id, code: 'SETOR-W-01', blocked: true, blockedReason: 'Buraco' } });
      const supplier = await createTestSupplier();
      const driver = await driverService.create({ name: 'M-VagaBloq', cpf: '45645645645', supplierId: supplier.id });
      const vehicle = await vehicleService.create({ plate: 'BLQ1234', type: 'TRUCK', supplierId: supplier.id });
      const visit = await yardVisitService.create({
        warehouseId: warehouse.id, serviceType: 'RECEBIMENTO', supplierId: supplier.id, scheduledAt: new Date(),
      });
      await yardVisitService.checkIn(visit.id, { driverId: driver.id, vehicleId: vehicle.id });

      await expect(yardVisitService.allocateSpot(visit.id, spot.id)).rejects.toThrow('Vaga está bloqueada');
    });

    it('rejeita alocar uma vaga já ocupada por outra visita IN_YARD', async () => {
      const { warehouse } = await createTestPositions(1, { positionType: 'DOCA' });
      await testPrisma.yardWarehouseParams.create({ data: { warehouseId: warehouse.id, useYard: true, delayToleranceMinutes: 15 } });
      const area = await testPrisma.yardArea.create({ data: { warehouseId: warehouse.id, code: 'SETOR-V', name: 'Setor V' } });
      const spot = await testPrisma.yardSpot.create({ data: { areaId: area.id, code: 'SETOR-V-01' } });
      const supplier = await createTestSupplier();
      const driver1 = await driverService.create({ name: 'D1', cpf: '65465465465', supplierId: supplier.id });
      const vehicle1 = await vehicleService.create({ plate: 'OCU1111', type: 'TRUCK', supplierId: supplier.id });
      const visit1 = await yardVisitService.create({
        warehouseId: warehouse.id, serviceType: 'RECEBIMENTO', supplierId: supplier.id, scheduledAt: new Date(),
      });
      await yardVisitService.checkIn(visit1.id, { driverId: driver1.id, vehicleId: vehicle1.id });
      await yardVisitService.allocateSpot(visit1.id, spot.id);

      const driver2 = await driverService.create({ name: 'D2', cpf: '65465465466', supplierId: supplier.id });
      const vehicle2 = await vehicleService.create({ plate: 'OCU2222', type: 'TRUCK', supplierId: supplier.id });
      const visit2 = await yardVisitService.create({
        warehouseId: warehouse.id, serviceType: 'RECEBIMENTO', supplierId: supplier.id, scheduledAt: new Date(),
      });
      await yardVisitService.checkIn(visit2.id, { driverId: driver2.id, vehicleId: vehicle2.id });

      await expect(yardVisitService.allocateSpot(visit2.id, spot.id)).rejects.toThrow('Vaga já está ocupada');
    });

    it('rejeita alocar uma vaga de área de OUTRO armazém', async () => {
      const { warehouse: wh1 } = await createTestPositions(1, { positionType: 'DOCA' });
      const { warehouse: wh2 } = await createTestPositions(1, { positionType: 'DOCA' });
      await testPrisma.yardWarehouseParams.create({ data: { warehouseId: wh1.id, useYard: true, delayToleranceMinutes: 15 } });
      const areaOfWh2 = await testPrisma.yardArea.create({ data: { warehouseId: wh2.id, code: 'SETOR-OUTRO', name: 'Setor de outro armazém' } });
      const spotOfWh2 = await testPrisma.yardSpot.create({ data: { areaId: areaOfWh2.id, code: 'SETOR-OUTRO-01' } });
      const supplier = await createTestSupplier();
      const driver = await driverService.create({ name: 'M-Cross', cpf: '78978978978', supplierId: supplier.id });
      const vehicle = await vehicleService.create({ plate: 'CRS1234', type: 'TRUCK', supplierId: supplier.id });
      const visit = await yardVisitService.create({
        warehouseId: wh1.id, serviceType: 'RECEBIMENTO', supplierId: supplier.id, scheduledAt: new Date(),
      });
      await yardVisitService.checkIn(visit.id, { driverId: driver.id, vehicleId: vehicle.id });

      await expect(yardVisitService.allocateSpot(visit.id, spotOfWh2.id)).rejects.toThrow(
        'A vaga informada pertence a outro armazém'
      );
    });
  });

  describe('operação de doca', () => {
    async function setupCheckedInVisitAtDock() {
      const { warehouse } = await createTestPositions(1, { positionType: 'DOCA' });
      await testPrisma.yardWarehouseParams.create({ data: { warehouseId: warehouse.id, useYard: false, delayToleranceMinutes: 15 } });
      const dock = await testPrisma.yardDock.create({ data: { warehouseId: warehouse.id, code: 'DOCA-OP-01', serviceType: 'RECEBIMENTO' } });
      const supplier = await createTestSupplier();
      const driver = await driverService.create({ name: 'M-Doca', cpf: '11133355577', supplierId: supplier.id });
      const vehicle = await vehicleService.create({ plate: 'DCK1234', type: 'TRUCK', supplierId: supplier.id });
      const visit = await yardVisitService.create({
        warehouseId: warehouse.id, serviceType: 'RECEBIMENTO', supplierId: supplier.id, scheduledAt: new Date(),
      });
      await yardVisitService.checkIn(visit.id, { driverId: driver.id, vehicleId: vehicle.id });
      return { warehouse, dock, visit };
    }

    it('move uma visita CHECKED_IN direto pra doca quando o armazém não usa pátio', async () => {
      const { dock, visit } = await setupCheckedInVisitAtDock();

      const moved = await yardVisitService.moveToDock(visit.id, dock.id);

      expect(moved.status).toBe('AT_DOCK');
      expect(moved.yardDockId).toBe(dock.id);
      expect(moved.dockArrivedAt).not.toBeNull();
    });

    it('rejeita mover pra uma doca com tipo de serviço incompatível', async () => {
      const { warehouse, visit } = await setupCheckedInVisitAtDock();
      const expeditionDock = await testPrisma.yardDock.create({ data: { warehouseId: warehouse.id, code: 'DOCA-OP-02', serviceType: 'EXPEDICAO' } });

      await expect(yardVisitService.moveToDock(visit.id, expeditionDock.id)).rejects.toThrow(
        'Tipo de serviço da doca incompatível com a visita'
      );
    });

    it('permite mover pra uma doca MULTIUSO independente do tipo de serviço da visita', async () => {
      const { warehouse, visit } = await setupCheckedInVisitAtDock();
      const multiDock = await testPrisma.yardDock.create({ data: { warehouseId: warehouse.id, code: 'DOCA-OP-03', serviceType: 'MULTIUSO' } });

      await expect(yardVisitService.moveToDock(visit.id, multiDock.id)).resolves.toMatchObject({ status: 'AT_DOCK' });
    });

    it('rejeita mover pra uma doca já ocupada por outra visita', async () => {
      const { dock, visit: visit1 } = await setupCheckedInVisitAtDock();
      await yardVisitService.moveToDock(visit1.id, dock.id);

      // Segunda visita CHECKED_IN no MESMO armazém do dock já ocupado por visit1.
      const supplier = await createTestSupplier();
      const driver2 = await driverService.create({ name: 'D2', cpf: '22244466688', supplierId: supplier.id });
      const vehicle2 = await vehicleService.create({ plate: 'DCK5678', type: 'TRUCK', supplierId: supplier.id });
      const visit2 = await yardVisitService.create({
        warehouseId: dock.warehouseId, serviceType: 'RECEBIMENTO', supplierId: supplier.id, scheduledAt: new Date(),
      });
      await yardVisitService.checkIn(visit2.id, { driverId: driver2.id, vehicleId: vehicle2.id });

      await expect(yardVisitService.moveToDock(visit2.id, dock.id)).rejects.toThrow('Doca já está ocupada');
    });

    it('inicia e conclui a carga/descarga, e finaliza com checkout preenchendo completedAt', async () => {
      const { dock, visit } = await setupCheckedInVisitAtDock();
      await yardVisitService.moveToDock(visit.id, dock.id);

      const started = await yardVisitService.startLoading(visit.id);
      expect(started.loadingStartedAt).not.toBeNull();

      const ended = await yardVisitService.endLoading(visit.id);
      expect(ended.loadingEndedAt).not.toBeNull();

      const completed = await yardVisitService.complete(visit.id);
      expect(completed.status).toBe('COMPLETED');
      expect(completed.completedAt).not.toBeNull();
    });

    it('rejeita iniciar carga duas vezes', async () => {
      const { dock, visit } = await setupCheckedInVisitAtDock();
      await yardVisitService.moveToDock(visit.id, dock.id);
      await yardVisitService.startLoading(visit.id);

      await expect(yardVisitService.startLoading(visit.id)).rejects.toThrow('Carga/descarga já foi iniciada');
    });

    it('rejeita concluir carga sem ter iniciado', async () => {
      const { dock, visit } = await setupCheckedInVisitAtDock();
      await yardVisitService.moveToDock(visit.id, dock.id);

      await expect(yardVisitService.endLoading(visit.id)).rejects.toThrow('Carga/descarga ainda não foi iniciada');
    });

    it('permite checkout mesmo sem carga formalmente iniciada/concluída', async () => {
      const { dock, visit } = await setupCheckedInVisitAtDock();
      await yardVisitService.moveToDock(visit.id, dock.id);

      await expect(yardVisitService.complete(visit.id)).resolves.toMatchObject({ status: 'COMPLETED' });
    });

    it('libera a doca (volta a ficar livre) depois do checkout', async () => {
      const { dock, visit } = await setupCheckedInVisitAtDock();
      await yardVisitService.moveToDock(visit.id, dock.id);
      await yardVisitService.complete(visit.id);

      const occupied = await testPrisma.yardVisit.findFirst({ where: { yardDockId: dock.id, status: 'AT_DOCK' } });
      expect(occupied).toBeNull();
    });
  });
});
