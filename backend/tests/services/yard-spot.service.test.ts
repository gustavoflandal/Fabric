import { cleanDatabase, disconnectTestDb, testPrisma } from '../helpers/db';
import yardAreaService from '../../src/services/yard-area.service';
import yardSpotService from '../../src/services/yard-spot.service';

async function createTestArea() {
  const warehouse = await testPrisma.warehouse.create({ data: { code: `WH-${Date.now()}-${Math.random()}`, name: 'Armazém Teste' } });
  return yardAreaService.create({ warehouseId: warehouse.id, code: 'SETOR-TEST', name: 'Setor de Teste' });
}

describe('YardSpotService', () => {
  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('gera vagas em lote, numeradas sequencialmente a partir de 01', async () => {
    const area = await createTestArea();

    const spots = await yardSpotService.generateBatch(area.id, 5);

    expect(spots).toHaveLength(5);
    expect(spots.map((s) => s.code).sort()).toEqual([
      'SETOR-TEST-01', 'SETOR-TEST-02', 'SETOR-TEST-03', 'SETOR-TEST-04', 'SETOR-TEST-05',
    ]);
  });

  it('continua a numeração a partir da maior sequência já existente na área', async () => {
    const area = await createTestArea();
    await yardSpotService.generateBatch(area.id, 3); // gera -01, -02, -03

    const moreSpots = await yardSpotService.generateBatch(area.id, 2);

    expect(moreSpots.map((s) => s.code).sort()).toEqual(['SETOR-TEST-04', 'SETOR-TEST-05']);
  });

  it('rejeita gerar 0 ou mais de 500 vagas de uma vez', async () => {
    const area = await createTestArea();

    await expect(yardSpotService.generateBatch(area.id, 0)).rejects.toThrow();
    await expect(yardSpotService.generateBatch(area.id, 501)).rejects.toThrow();
  });

  it('rejeita gerar vagas para área inexistente', async () => {
    await expect(yardSpotService.generateBatch('id-que-nao-existe', 3)).rejects.toThrow('Área informada não existe');
  });

  it('bloqueia uma vaga individual com motivo', async () => {
    const area = await createTestArea();
    const [spot] = await yardSpotService.generateBatch(area.id, 1);

    const blocked = await yardSpotService.setBlocked(spot.id, true, 'Buraco no asfalto');

    expect(blocked.blocked).toBe(true);
  });

  it('lista vagas filtrando por área', async () => {
    const area1 = await createTestArea();
    const area2 = await createTestArea();
    await yardSpotService.generateBatch(area1.id, 2);
    await yardSpotService.generateBatch(area2.id, 3);

    const result = await yardSpotService.getAll(1, 100, { areaId: area1.id });

    expect(result.data).toHaveLength(2);
  });
});
