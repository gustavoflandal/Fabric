import { cleanDatabase, disconnectTestDb, testPrisma } from '../helpers/db';
import { createTestPositions } from '../helpers/fixtures';
import yardDockService from '../../src/services/yard-dock.service';

describe('YardDockService', () => {
  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('cria uma doca sem vínculo com StoragePosition', async () => {
    const { warehouse } = await createTestPositions(1, { positionType: 'DOCA' });

    const dock = await yardDockService.create({
      code: 'DOCA-01',
      serviceType: 'RECEBIMENTO',
      warehouseId: warehouse.id,
    });

    expect(dock.code).toBe('DOCA-01');
    expect(dock.storagePositionId).toBeNull();
    expect(dock.active).toBe(true);
  });

  it('cria uma doca vinculada a uma StoragePosition existente do tipo DOCA', async () => {
    const { warehouse, positions } = await createTestPositions(1, { positionType: 'DOCA' });

    const dock = await yardDockService.create({
      code: 'DOCA-02',
      serviceType: 'EXPEDICAO',
      warehouseId: warehouse.id,
      storagePositionId: positions[0].id,
    });

    expect(dock.storagePositionId).toBe(positions[0].id);
  });

  it('rejeita vincular a uma StoragePosition que não é do tipo DOCA', async () => {
    const { warehouse, positions } = await createTestPositions(1, { positionType: 'PORTA_PALETES' });

    await expect(
      yardDockService.create({
        code: 'DOCA-03',
        serviceType: 'MULTIUSO',
        warehouseId: warehouse.id,
        storagePositionId: positions[0].id,
      })
    ).rejects.toThrow('A posição informada não é do tipo DOCA');
  });

  it('rejeita código de doca duplicado no mesmo armazém', async () => {
    const { warehouse } = await createTestPositions(1, { positionType: 'DOCA' });
    await yardDockService.create({ code: 'DOCA-04', serviceType: 'RECEBIMENTO', warehouseId: warehouse.id });

    await expect(
      yardDockService.create({ code: 'DOCA-04', serviceType: 'EXPEDICAO', warehouseId: warehouse.id })
    ).rejects.toThrow('Já existe uma doca com este código neste armazém');
  });

  it('permite o mesmo código de doca em armazéns diferentes', async () => {
    const { warehouse: wh1 } = await createTestPositions(1, { positionType: 'DOCA' });
    const { warehouse: wh2 } = await createTestPositions(1, { positionType: 'DOCA' });
    await yardDockService.create({ code: 'DOCA-05', serviceType: 'RECEBIMENTO', warehouseId: wh1.id });

    await expect(
      yardDockService.create({ code: 'DOCA-05', serviceType: 'RECEBIMENTO', warehouseId: wh2.id })
    ).resolves.toBeDefined();
  });

  it('lista docas filtrando por armazém', async () => {
    const { warehouse: wh1 } = await createTestPositions(1, { positionType: 'DOCA' });
    const { warehouse: wh2 } = await createTestPositions(1, { positionType: 'DOCA' });
    await yardDockService.create({ code: 'DOCA-A', serviceType: 'RECEBIMENTO', warehouseId: wh1.id });
    await yardDockService.create({ code: 'DOCA-B', serviceType: 'RECEBIMENTO', warehouseId: wh2.id });

    const result = await yardDockService.getAll(1, 100, { warehouseId: wh1.id });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].code).toBe('DOCA-A');
  });

  it('toggleActive-like: update altera active', async () => {
    const { warehouse } = await createTestPositions(1, { positionType: 'DOCA' });
    const dock = await yardDockService.create({ code: 'DOCA-06', serviceType: 'RECEBIMENTO', warehouseId: warehouse.id });

    const updated = await yardDockService.update(dock.id, { active: false });
    expect(updated.active).toBe(false);
  });

  it('rejeita vincular duas docas à mesma StoragePosition', async () => {
    const { warehouse, positions } = await createTestPositions(2, { positionType: 'DOCA' });
    await yardDockService.create({
      code: 'DOCA-07',
      serviceType: 'RECEBIMENTO',
      warehouseId: warehouse.id,
      storagePositionId: positions[0].id,
    });

    await expect(
      yardDockService.create({
        code: 'DOCA-08',
        serviceType: 'EXPEDICAO',
        warehouseId: warehouse.id,
        storagePositionId: positions[0].id,
      })
    ).rejects.toThrow('Esta posição de armazenagem já está vinculada a outra doca');
  });

  it('permite update de doca para a mesma StoragePosition (no-op relink)', async () => {
    const { warehouse, positions } = await createTestPositions(1, { positionType: 'DOCA' });
    const dock = await yardDockService.create({
      code: 'DOCA-09',
      serviceType: 'RECEBIMENTO',
      warehouseId: warehouse.id,
      storagePositionId: positions[0].id,
    });

    const updated = await yardDockService.update(dock.id, { storagePositionId: positions[0].id });
    expect(updated.storagePositionId).toBe(positions[0].id);
  });

  describe('delete', () => {
    it('rejeita excluir uma doca com uma visita AT_DOCK nela', async () => {
      const { warehouse } = await createTestPositions(1, { positionType: 'DOCA' });
      const dock = await yardDockService.create({ code: 'DOCA-10', serviceType: 'RECEBIMENTO', warehouseId: warehouse.id });
      await testPrisma.yardVisit.create({
        data: {
          warehouseId: warehouse.id,
          serviceType: 'RECEBIMENTO',
          scheduledAt: new Date(),
          status: 'AT_DOCK',
          yardDockId: dock.id,
        },
      });

      await expect(yardDockService.delete(dock.id)).rejects.toThrow(
        'Não é possível excluir uma doca com um veículo nela'
      );
    });

    it('permite excluir uma doca sem visita ativa', async () => {
      const { warehouse } = await createTestPositions(1, { positionType: 'DOCA' });
      const dock = await yardDockService.create({ code: 'DOCA-11', serviceType: 'RECEBIMENTO', warehouseId: warehouse.id });

      await expect(yardDockService.delete(dock.id)).resolves.toBeDefined();
      const stillExists = await testPrisma.yardDock.findUnique({ where: { id: dock.id } });
      expect(stillExists).toBeNull();
    });
  });
});
