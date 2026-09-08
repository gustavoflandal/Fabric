import { cleanDatabase, disconnectTestDb } from '../helpers/db';
import { createTestSupplier } from '../helpers/fixtures';
import driverService from '../../src/services/driver.service';

describe('DriverService', () => {
  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('cria um motorista vinculado a um fornecedor existente', async () => {
    const supplier = await createTestSupplier();

    const driver = await driverService.create({
      name: 'João da Silva',
      cpf: '12345678901',
      supplierId: supplier.id,
    });

    expect(driver.name).toBe('João da Silva');
    expect(driver.supplierId).toBe(supplier.id);
    expect(driver.blocked).toBe(false);
  });

  it('rejeita criar motorista com supplierId inexistente', async () => {
    await expect(
      driverService.create({ name: 'Maria Souza', cpf: '10987654321', supplierId: 'id-que-nao-existe' })
    ).rejects.toThrow('Fornecedor informado não existe');
  });

  it('rejeita CPF duplicado com mensagem clara', async () => {
    const supplier = await createTestSupplier();
    await driverService.create({ name: 'Motorista 1', cpf: '11111111111', supplierId: supplier.id });

    await expect(
      driverService.create({ name: 'Motorista 2', cpf: '11111111111', supplierId: supplier.id })
    ).rejects.toThrow('Já existe um motorista cadastrado com este CPF');
  });

  it('rejeita atualizar para um CPF já usado por outro motorista', async () => {
    const supplier = await createTestSupplier();
    await driverService.create({ name: 'Motorista 1', cpf: '66666666666', supplierId: supplier.id });
    const driver2 = await driverService.create({ name: 'Motorista 2', cpf: '77777777777', supplierId: supplier.id });

    await expect(driverService.update(driver2.id, { cpf: '66666666666' })).rejects.toThrow(
      'Já existe um motorista cadastrado com este CPF'
    );
  });

  it('bloqueia um motorista com motivo', async () => {
    const supplier = await createTestSupplier();
    const driver = await driverService.create({ name: 'Motorista 3', cpf: '22222222222', supplierId: supplier.id });

    const blocked = await driverService.setBlocked(driver.id, true, 'CNH vencida');

    expect(blocked.blocked).toBe(true);
    expect(blocked.blockedReason).toBe('CNH vencida');
  });

  it('desbloqueia um motorista, limpando o motivo', async () => {
    const supplier = await createTestSupplier();
    const driver = await driverService.create({ name: 'Motorista 4', cpf: '33333333333', supplierId: supplier.id });
    await driverService.setBlocked(driver.id, true, 'Motivo qualquer');

    const unblocked = await driverService.setBlocked(driver.id, false, null);

    expect(unblocked.blocked).toBe(false);
    expect(unblocked.blockedReason).toBeNull();
  });

  it('lista motoristas filtrando por fornecedor', async () => {
    const sup1 = await createTestSupplier();
    const sup2 = await createTestSupplier();
    await driverService.create({ name: 'A', cpf: '44444444444', supplierId: sup1.id });
    await driverService.create({ name: 'B', cpf: '55555555555', supplierId: sup2.id });

    const result = await driverService.getAll(1, 100, { supplierId: sup1.id });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].name).toBe('A');
  });
});
