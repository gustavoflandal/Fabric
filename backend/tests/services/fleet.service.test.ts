import { cleanDatabase, disconnectTestDb } from '../helpers/db';
import { createTestSupplier } from '../helpers/fixtures';
import fleetService from '../../src/services/fleet.service';

describe('FleetService', () => {
  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('cria uma frota vinculada a um fornecedor existente', async () => {
    const supplier = await createTestSupplier();

    const fleet = await fleetService.create({ name: 'Frota Refrigerada', supplierId: supplier.id });

    expect(fleet.name).toBe('Frota Refrigerada');
    expect(fleet.supplierId).toBe(supplier.id);
    expect(fleet.blocked).toBe(false);
  });

  it('rejeita criar frota com supplierId inexistente', async () => {
    await expect(
      fleetService.create({ name: 'Frota X', supplierId: 'id-que-nao-existe' })
    ).rejects.toThrow('Fornecedor informado não existe');
  });

  it('bloqueia uma frota com motivo', async () => {
    const supplier = await createTestSupplier();
    const fleet = await fleetService.create({ name: 'Frota Seca', supplierId: supplier.id });

    const blocked = await fleetService.setBlocked(fleet.id, true, 'Inadimplência do fornecedor');

    expect(blocked.blocked).toBe(true);
    expect(blocked.blockedReason).toBe('Inadimplência do fornecedor');
  });

  it('lista frotas filtrando por fornecedor', async () => {
    const sup1 = await createTestSupplier();
    const sup2 = await createTestSupplier();
    await fleetService.create({ name: 'Frota A', supplierId: sup1.id });
    await fleetService.create({ name: 'Frota B', supplierId: sup2.id });

    const result = await fleetService.getAll(1, 100, { supplierId: sup1.id });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].name).toBe('Frota A');
  });
});
