import {
  buildPositionCode,
  generatePositions,
  getPositionsByStructure,
  getPositionByCode,
} from '../../src/services/storage-position.service';
import { AppError } from '../../src/middleware/error.middleware';
import { cleanDatabase, disconnectTestDb, testPrisma } from '../helpers/db';

/**
 * F0.1 e F0.2 do plano do WMS
 * (docs/fase-2026-09-modernizacao/WMS_IMPLEMENTATION_ANALYSIS.md).
 *
 * O endereço da posição deixou de ser uma string montada em memória a cada
 * leitura e passou a ser coluna persistida e única — é o identificador em que
 * todo o resto do WMS (saldo por posição, movimentação, etiqueta, coletor) vai
 * se pendurar a partir da Fase 1. Estes testes travam as duas propriedades que
 * importam: o FORMATO do código gerado e a possibilidade de resolver uma
 * posição a partir dele.
 */

// Código fixo de propósito: `cleanDatabase()` roda no afterEach, então cada
// teste começa com o banco vazio e pode assumir o mesmo endereço esperado.
const WAREHOUSE_CODE = 'ARM1';

async function createStructure(overrides: { floors?: number; positions?: number } = {}) {
  const warehouse = await testPrisma.warehouse.create({
    data: { code: WAREHOUSE_CODE, name: 'Armazém de Teste' },
  });

  const structure = await testPrisma.warehouseStructure.create({
    data: {
      warehouseId: warehouse.id,
      streetCode: 'R01',
      floors: overrides.floors ?? 2,
      positions: overrides.positions ?? 3,
      positionType: 'PORTA_PALETES',
      weightCapacity: 1000,
      height: 2,
      width: 1.2,
      depth: 1.1,
      maxHeight: 1.8,
    },
  });

  return { warehouse, structure };
}

describe('storage-position.service (F0.1/F0.2)', () => {
  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  describe('buildPositionCode', () => {
    it('usa o formato ARM-RUA-AA-PP com andar e posição em 2 dígitos', () => {
      expect(
        buildPositionCode({ warehouseCode: 'ARM1', streetCode: 'R01', floor: 1, position: 7 })
      ).toBe('ARM1-R01-01-07');

      expect(
        buildPositionCode({ warehouseCode: 'CD', streetCode: 'A', floor: 12, position: 34 })
      ).toBe('CD-A-12-34');
    });
  });

  describe('generatePositions', () => {
    it('persiste o code de cada posição gerada', async () => {
      const { structure } = await createStructure({ floors: 2, positions: 3 });

      const generated = await generatePositions(structure.id);

      expect(generated).toHaveLength(6);
      expect(generated.map((p) => p.code)).toEqual([
        'ARM1-R01-01-01',
        'ARM1-R01-01-02',
        'ARM1-R01-01-03',
        'ARM1-R01-02-01',
        'ARM1-R01-02-02',
        'ARM1-R01-02-03',
      ]);
    });

    it('rejeita com 409 quando outra estrutura do mesmo armazém já ocupa esses endereços', async () => {
      const { warehouse } = await createStructure({ floors: 1, positions: 2 });
      const duplicate = await testPrisma.warehouseStructure.create({
        data: {
          warehouseId: warehouse.id,
          streetCode: 'R01', // mesmo código de rua -> mesmos endereços
          floors: 1,
          positions: 2,
          positionType: 'PORTA_PALETES',
        },
      });

      await generatePositions(
        (await testPrisma.warehouseStructure.findFirstOrThrow({
          where: { warehouseId: warehouse.id, id: { not: duplicate.id } },
        })).id
      );

      await expect(generatePositions(duplicate.id)).rejects.toMatchObject({
        statusCode: 409,
      });
    });

    it('aceita estrutura de tipo de área sem dimensões (F0.3)', async () => {
      const warehouse = await testPrisma.warehouse.create({
        data: { code: WAREHOUSE_CODE, name: 'Armazém de Teste' },
      });
      // Nenhum campo dimensional: um piso/doca não tem paletização. Antes de
      // F0.3 isso era impossível — as cinco colunas eram NOT NULL.
      const structure = await testPrisma.warehouseStructure.create({
        data: {
          warehouseId: warehouse.id,
          streetCode: 'DOCA',
          floors: 1,
          positions: 2,
          positionType: 'DOCA',
        },
      });

      const generated = await generatePositions(structure.id);

      expect(generated.map((p) => p.code)).toEqual(['ARM1-DOCA-01-01', 'ARM1-DOCA-01-02']);
      expect(generated[0].weightCapacity).toBeNull();
      expect(generated[0].maxHeight).toBeNull();
    });

    it('não trunca andar/posição com mais de 2 dígitos', async () => {
      const { structure } = await createStructure({ floors: 1, positions: 125 });

      const generated = await generatePositions(structure.id);

      expect(generated).toHaveLength(125);
      // padStart não trunca — e o backfill SQL da migration usa
      // LPAD(x, GREATEST(2, CHAR_LENGTH(x)), '0') justamente porque o LPAD do
      // MySQL truncaria para '12'.
      expect(generated[124].code).toBe('ARM1-R01-01-125');
      expect(new Set(generated.map((p) => p.code)).size).toBe(125);
    });

    it('getPositionsByStructure devolve o code lido da coluna, não concatenado', async () => {
      const { structure } = await createStructure({ floors: 1, positions: 1 });
      await generatePositions(structure.id);

      // Reescreve a coluna com um valor que a antiga concatenação em memória
      // JAMAIS produziria: se a leitura ainda estivesse montando a string, este
      // valor seria ignorado e o teste falharia.
      await testPrisma.storagePosition.updateMany({
        where: { structureId: structure.id },
        data: { code: 'CODIGO-PERSISTIDO' },
      });

      const positions = await getPositionsByStructure(structure.id);

      expect(positions).toHaveLength(1);
      expect(positions[0].code).toBe('CODIGO-PERSISTIDO');
    });
  });

  describe('getPositionByCode', () => {
    it('resolve a posição pelo endereço, trazendo estrutura e armazém', async () => {
      const { structure } = await createStructure({ floors: 1, positions: 2 });
      await generatePositions(structure.id);

      const position = await getPositionByCode('ARM1-R01-01-02');

      expect(position.floor).toBe(1);
      expect(position.position).toBe(2);
      expect(position.structure.warehouse.code).toBe('ARM1');
    });

    it('ignora espaços em volta do código lido (coletor/scanner)', async () => {
      const { structure } = await createStructure({ floors: 1, positions: 1 });
      await generatePositions(structure.id);

      const position = await getPositionByCode('  arm1-r01-01-01 ');

      expect(position.code).toBe('ARM1-R01-01-01');
    });

    it('lança AppError 404 para código inexistente', async () => {
      await expect(getPositionByCode('NAO-EXISTE-99-99')).rejects.toMatchObject({
        statusCode: 404,
      });
      await expect(getPositionByCode('NAO-EXISTE-99-99')).rejects.toBeInstanceOf(AppError);
    });
  });
});
