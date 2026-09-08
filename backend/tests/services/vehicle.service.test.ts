import { cleanDatabase, disconnectTestDb } from '../helpers/db';
import { createTestSupplier } from '../helpers/fixtures';
import vehicleService from '../../src/services/vehicle.service';
import fleetService from '../../src/services/fleet.service';

describe('VehicleService', () => {
  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('cria um veículo com placa no padrão Mercosul, normalizada para maiúsculas', async () => {
    const supplier = await createTestSupplier();

    const vehicle = await vehicleService.create({
      plate: 'abc1d23',
      type: 'TRUCK',
      supplierId: supplier.id,
    });

    expect(vehicle.plate).toBe('ABC1D23');
  });

  it('cria um veículo com placa no padrão antigo', async () => {
    const supplier = await createTestSupplier();

    const vehicle = await vehicleService.create({ plate: 'ABC1234', type: 'TOCO', supplierId: supplier.id });

    expect(vehicle.plate).toBe('ABC1234');
  });

  it('rejeita placa em formato inválido', async () => {
    const supplier = await createTestSupplier();

    await expect(
      vehicleService.create({ plate: 'AB-1234', type: 'VAN', supplierId: supplier.id })
    ).rejects.toThrow('Placa em formato inválido');
  });

  it('rejeita placa duplicada, inclusive quando digitada com caixa diferente', async () => {
    const supplier = await createTestSupplier();
    await vehicleService.create({ plate: 'ABC1234', type: 'VAN', supplierId: supplier.id });

    await expect(
      vehicleService.create({ plate: 'abc1234', type: 'TRUCK', supplierId: supplier.id })
    ).rejects.toThrow('Já existe um veículo cadastrado com esta placa');
  });

  it('rejeita criar veículo com supplierId inexistente', async () => {
    await expect(
      vehicleService.create({ plate: 'ABC1234', type: 'VAN', supplierId: 'id-que-nao-existe' })
    ).rejects.toThrow('Fornecedor informado não existe');
  });

  it('cria um veículo vinculado a uma frota do mesmo fornecedor', async () => {
    const supplier = await createTestSupplier();
    const fleet = await fleetService.create({ name: 'Frota A', supplierId: supplier.id });

    const vehicle = await vehicleService.create({
      plate: 'ABC1234',
      type: 'CAVALO',
      supplierId: supplier.id,
      fleetId: fleet.id,
    });

    expect(vehicle.fleetId).toBe(fleet.id);
  });

  it('rejeita vincular veículo a uma frota de OUTRO fornecedor', async () => {
    const supplier1 = await createTestSupplier();
    const supplier2 = await createTestSupplier();
    const fleetOfSupplier2 = await fleetService.create({ name: 'Frota do Fornecedor 2', supplierId: supplier2.id });

    await expect(
      vehicleService.create({
        plate: 'ABC1234',
        type: 'CAVALO',
        supplierId: supplier1.id,
        fleetId: fleetOfSupplier2.id,
      })
    ).rejects.toThrow('A frota informada pertence a outro fornecedor');
  });

  it('bloqueia um veículo com motivo', async () => {
    const supplier = await createTestSupplier();
    const vehicle = await vehicleService.create({ plate: 'ABC1234', type: 'VAN', supplierId: supplier.id });

    const blocked = await vehicleService.setBlocked(vehicle.id, true, 'Documentação vencida');

    expect(blocked.blocked).toBe(true);
    expect(blocked.blockedReason).toBe('Documentação vencida');
  });

  it('lista veículos filtrando por frota', async () => {
    const supplier = await createTestSupplier();
    const fleet = await fleetService.create({ name: 'Frota B', supplierId: supplier.id });
    await vehicleService.create({ plate: 'ABC1111', type: 'TRUCK', supplierId: supplier.id, fleetId: fleet.id });
    await vehicleService.create({ plate: 'ABC2222', type: 'TRUCK', supplierId: supplier.id });

    const result = await vehicleService.getAll(1, 100, { fleetId: fleet.id });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].plate).toBe('ABC1111');
  });

  it('ao atualizar, reporta fornecedor inexistente antes de comparar a frota (não mascara o erro real)', async () => {
    const supplier = await createTestSupplier();
    const fleet = await fleetService.create({ name: 'Frota C', supplierId: supplier.id });
    const vehicle = await vehicleService.create({
      plate: 'ABC5001',
      type: 'CAVALO',
      supplierId: supplier.id,
      fleetId: fleet.id,
    });

    await expect(
      vehicleService.update(vehicle.id, { supplierId: 'id-que-nao-existe', fleetId: fleet.id })
    ).rejects.toThrow('Fornecedor informado não existe');
  });

  it('ao atualizar apenas a frota, usa o supplierId atual do veículo para validar o vínculo', async () => {
    const supplier = await createTestSupplier();
    const vehicle = await vehicleService.create({ plate: 'ABC5002', type: 'TRUCK', supplierId: supplier.id });
    const fleet = await fleetService.create({ name: 'Frota D', supplierId: supplier.id });

    await expect(vehicleService.update(vehicle.id, { fleetId: fleet.id })).resolves.toMatchObject({
      fleetId: fleet.id,
    });
  });

  it('rejeita atualizar apenas a frota quando ela pertence a outro fornecedor (sem passar supplierId)', async () => {
    const supplier = await createTestSupplier();
    const outroSupplier = await createTestSupplier();
    const vehicle = await vehicleService.create({ plate: 'ABC5003', type: 'TRUCK', supplierId: supplier.id });
    const fleetDeOutroFornecedor = await fleetService.create({ name: 'Frota E', supplierId: outroSupplier.id });

    await expect(
      vehicleService.update(vehicle.id, { fleetId: fleetDeOutroFornecedor.id })
    ).rejects.toThrow('A frota informada pertence a outro fornecedor');
  });

  it('permite reenviar a mesma placa do próprio veículo ao atualizar (exclui o próprio id da checagem)', async () => {
    const supplier = await createTestSupplier();
    const vehicle = await vehicleService.create({ plate: 'ABC5004', type: 'VAN', supplierId: supplier.id });

    await expect(vehicleService.update(vehicle.id, { plate: 'ABC5004' })).resolves.toMatchObject({
      plate: 'ABC5004',
    });
  });
});
