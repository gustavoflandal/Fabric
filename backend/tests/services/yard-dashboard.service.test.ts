import { cleanDatabase, disconnectTestDb, testPrisma } from '../helpers/db';
import { createTestPositions, createTestSupplier, createTestManager } from '../helpers/fixtures';
import yardDashboardService from '../../src/services/yard-dashboard.service';
import yardVisitService from '../../src/services/yard-visit.service';
import driverService from '../../src/services/driver.service';
import vehicleService from '../../src/services/vehicle.service';

async function setupWarehouseWithParams(useYard = false) {
  const { warehouse } = await createTestPositions(1, { positionType: 'DOCA' });
  await testPrisma.yardWarehouseParams.create({ data: { warehouseId: warehouse.id, useYard, delayToleranceMinutes: 15 } });
  return warehouse;
}

describe('YardDashboardService', () => {
  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('modo tempo real: conta só visitas abertas (CHECKED_IN/IN_YARD/AT_DOCK)', async () => {
    const warehouse = await setupWarehouseWithParams();
    const supplier = await createTestSupplier();
    const driver = await driverService.create({ name: 'D1', cpf: '11111111111', supplierId: supplier.id });
    const vehicle = await vehicleService.create({ plate: 'DSH1111', type: 'TRUCK', supplierId: supplier.id });
    const openVisit = await yardVisitService.create({
      warehouseId: warehouse.id, serviceType: 'RECEBIMENTO', supplierId: supplier.id, scheduledAt: new Date(),
    });
    await yardVisitService.checkIn(openVisit.id, { driverId: driver.id, vehicleId: vehicle.id });

    const driver2 = await driverService.create({ name: 'D2', cpf: '22222222222', supplierId: supplier.id });
    const vehicle2 = await vehicleService.create({ plate: 'DSH2222', type: 'TRUCK', supplierId: supplier.id });
    const cancelledVisit = await yardVisitService.create({
      warehouseId: warehouse.id, serviceType: 'RECEBIMENTO', supplierId: supplier.id, scheduledAt: new Date(),
    });
    await yardVisitService.checkIn(cancelledVisit.id, { driverId: driver2.id, vehicleId: vehicle2.id });
    await yardVisitService.cancel(cancelledVisit.id);

    const dashboard = await yardDashboardService.getDashboard(warehouse.id);

    expect(dashboard.mode).toBe('REALTIME');
    expect(dashboard.totals.portaria).toBe(1);
    expect(dashboard.visits).toHaveLength(1);
  });

  it('modo histórico: inclui COMPLETED/CANCELLED dentro da janela de days', async () => {
    const warehouse = await setupWarehouseWithParams();
    const supplier = await createTestSupplier();
    const driver = await driverService.create({ name: 'D3', cpf: '33333333333', supplierId: supplier.id });
    const vehicle = await vehicleService.create({ plate: 'DSH3333', type: 'TRUCK', supplierId: supplier.id });
    const visit = await yardVisitService.create({
      warehouseId: warehouse.id, serviceType: 'RECEBIMENTO', supplierId: supplier.id, scheduledAt: new Date(),
    });
    await yardVisitService.checkIn(visit.id, { driverId: driver.id, vehicleId: vehicle.id });
    await yardVisitService.cancel(visit.id);

    const dashboard = await yardDashboardService.getDashboard(warehouse.id, 30);

    expect(dashboard.mode).toBe('HISTORICAL');
    expect(dashboard.visits).toHaveLength(1);
    expect(dashboard.visits[0].currentLocation).toBe('CANCELADA');
  });

  it('ocupação de pátio é null quando o armazém não tem nenhuma vaga cadastrada', async () => {
    const warehouse = await setupWarehouseWithParams();

    const dashboard = await yardDashboardService.getDashboard(warehouse.id);

    expect(dashboard.occupancy.patioPercent).toBeNull();
    expect(dashboard.occupancy.patioRatio).toBeNull();
  });

  it('calcula ocupação de pátio corretamente quando há vagas', async () => {
    const warehouse = await setupWarehouseWithParams(true);
    const area = await testPrisma.yardArea.create({ data: { warehouseId: warehouse.id, code: 'SETOR-DASH', name: 'Setor Dashboard' } });
    await testPrisma.yardSpot.createMany({
      data: [1, 2, 3, 4].map((n) => ({ areaId: area.id, code: `SETOR-DASH-0${n}` })),
    });
    const supplier = await createTestSupplier();
    const driver = await driverService.create({ name: 'D4', cpf: '44444444444', supplierId: supplier.id });
    const vehicle = await vehicleService.create({ plate: 'DSH4444', type: 'TRUCK', supplierId: supplier.id });
    const visit = await yardVisitService.create({
      warehouseId: warehouse.id, serviceType: 'RECEBIMENTO', supplierId: supplier.id, scheduledAt: new Date(),
    });
    await yardVisitService.checkIn(visit.id, { driverId: driver.id, vehicleId: vehicle.id });
    const spot = await testPrisma.yardSpot.findFirst({ where: { areaId: area.id } });
    await yardVisitService.allocateSpot(visit.id, spot!.id);

    const dashboard = await yardDashboardService.getDashboard(warehouse.id);

    expect(dashboard.occupancy.patioPercent).toBe(25); // 1/4
    expect(dashboard.occupancy.patioRatio).toBe('1/4');
  });

  it('deriva a origem do registro (MANUAL vs PURCHASE_ORDER)', async () => {
    const warehouse = await setupWarehouseWithParams();
    const supplier = await createTestSupplier();
    const manager = await createTestManager();
    const po = await testPrisma.purchaseOrder.create({
      data: { orderNumber: `PO-DASH-${Date.now()}`, supplierId: supplier.id, expectedDate: new Date(), totalValue: 0, createdBy: manager.id },
    });
    await yardVisitService.create({
      warehouseId: warehouse.id, serviceType: 'RECEBIMENTO', purchaseOrderId: po.id, scheduledAt: new Date(),
    });
    await yardVisitService.create({
      warehouseId: warehouse.id, serviceType: 'EXPEDICAO', supplierId: supplier.id, scheduledAt: new Date(),
    });

    const dashboard = await yardDashboardService.getDashboard(warehouse.id, 1);

    const origins = dashboard.visits.map((v) => v.origin).sort();
    expect(origins).toEqual(['MANUAL', 'PURCHASE_ORDER']);
  });

  it('rejeita chamar sem warehouseId', async () => {
    await expect(yardDashboardService.getDashboard('')).rejects.toThrow('Armazém é obrigatório');
  });

  it('modo histórico: visita aberta iniciada antes da janela de days ainda entra nos totais/ocupação', async () => {
    const warehouse = await setupWarehouseWithParams();
    const supplier = await createTestSupplier();
    const driver = await driverService.create({ name: 'D5', cpf: '55555555555', supplierId: supplier.id });
    const vehicle = await vehicleService.create({ plate: 'DSH5555', type: 'TRUCK', supplierId: supplier.id });
    const visit = await yardVisitService.create({
      warehouseId: warehouse.id, serviceType: 'RECEBIMENTO', supplierId: supplier.id, scheduledAt: new Date(),
    });
    await yardVisitService.checkIn(visit.id, { driverId: driver.id, vehicleId: vehicle.id });
    // Simula uma visita que começou muito antes da janela de `days` consultada,
    // mas que continua aberta (CHECKED_IN) até agora — é exatamente o cenário
    // que o `OR` no `where` de getDashboard existe para cobrir: sem ele, esta
    // visita ficaria de fora dos totais/ocupação em modo histórico com days=7.
    await testPrisma.yardVisit.update({
      where: { id: visit.id },
      data: { createdAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000) },
    });

    const dashboard = await yardDashboardService.getDashboard(warehouse.id, 7);

    expect(dashboard.mode).toBe('HISTORICAL');
    expect(dashboard.totals.portaria).toBe(1);
    expect(dashboard.visits.some((v) => v.id === visit.id)).toBe(true);
  });
});
