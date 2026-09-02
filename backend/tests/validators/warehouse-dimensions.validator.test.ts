import {
  createWarehouseStructureSchema,
  updateWarehouseStructureSchema,
} from '../../src/validators/warehouse-structure.validator';
import { updateStoragePositionSchema } from '../../src/validators/storage-position.validator';

/**
 * F0.3 do plano do WMS
 * (docs/fase-2026-09-modernizacao/WMS_IMPLEMENTATION_ANALYSIS.md).
 *
 * As colunas dimensionais viraram nullable no banco para permitir tipos de ÁREA
 * (piso, doca, quarentena, bloqueio, expedição), que não têm paletização. Mas a
 * obrigatoriedade é CONDICIONAL AO TIPO — algo que o schema do banco não
 * expressa e que, portanto, só existe enquanto estes validators existirem.
 * Estes testes são a rede que impede a mudança virar "dimensão opcional para
 * todo mundo", que era o risco real de F0.3.
 */

const rackPayload = {
  warehouseId: '2b5b3f7a-9f0e-4a0a-9c2d-5f1a7e4c8d31',
  streetCode: 'R01',
  floors: 3,
  positions: 10,
  positionType: 'PORTA_PALETES',
  weightCapacity: 1000,
  height: 2,
  width: 1.2,
  depth: 1.1,
  maxHeight: 1.8,
};

describe('Validators de dimensão condicional por tipo de posição (F0.3)', () => {
  describe('createWarehouseStructureSchema', () => {
    it('aceita tipo de rack com todas as dimensões', () => {
      const { error } = createWarehouseStructureSchema.validate(rackPayload);
      expect(error).toBeUndefined();
    });

    it('REJEITA tipo de rack sem dimensões', () => {
      const { weightCapacity, height, width, depth, maxHeight, ...semDimensoes } = rackPayload;

      const { error } = createWarehouseStructureSchema.validate(semDimensoes, {
        abortEarly: false,
      });

      expect(error).toBeDefined();
      const campos = error!.details.map((d) => d.path.join('.')).sort();
      expect(campos).toEqual(['depth', 'height', 'maxHeight', 'weightCapacity', 'width']);
    });

    it('aceita tipo de área SEM nenhuma dimensão', () => {
      const { weightCapacity, height, width, depth, maxHeight, ...base } = rackPayload;

      for (const positionType of ['PISO', 'DOCA', 'QUARENTENA', 'BLOQUEIO', 'EXPEDICAO']) {
        const { error } = createWarehouseStructureSchema.validate({ ...base, positionType });
        expect(error).toBeUndefined();
      }
    });

    it('aceita tipo de área com dimensão explicitamente nula', () => {
      const { error } = createWarehouseStructureSchema.validate({
        ...rackPayload,
        positionType: 'PISO',
        weightCapacity: null,
        height: null,
        width: null,
        depth: null,
        maxHeight: null,
      });

      expect(error).toBeUndefined();
    });

    it('continua rejeitando dimensão não-positiva em tipo de rack', () => {
      const { error } = createWarehouseStructureSchema.validate({
        ...rackPayload,
        weightCapacity: 0,
      });

      expect(error).toBeDefined();
    });

    it('rejeita positionType fora do enum', () => {
      const { error } = createWarehouseStructureSchema.validate({
        ...rackPayload,
        positionType: 'INVENTADO',
      });

      expect(error).toBeDefined();
    });
  });

  describe('updateWarehouseStructureSchema', () => {
    it('permite update parcial que não toca em tipo nem dimensão', () => {
      const { error } = updateWarehouseStructureSchema.validate({ blocked: true });
      expect(error).toBeUndefined();
    });

    it('exige as dimensões quando o update MUDA o tipo para um rack', () => {
      // Uma posição de área nunca teve dimensões; virar rack sem informá-las
      // deixaria a linha em um estado que a regra de alocação não sabe usar.
      const { error } = updateWarehouseStructureSchema.validate(
        { positionType: 'DRIVE_IN' },
        { abortEarly: false }
      );

      expect(error).toBeDefined();
      expect(error!.details).toHaveLength(5);
    });

    it('não exige dimensões quando o update MUDA o tipo para uma área', () => {
      const { error } = updateWarehouseStructureSchema.validate({ positionType: 'EXPEDICAO' });
      expect(error).toBeUndefined();
    });
  });

  describe('updateStoragePositionSchema', () => {
    it('permite apenas bloquear/desbloquear a posição', () => {
      const { error } = updateStoragePositionSchema.validate({ blocked: true });
      expect(error).toBeUndefined();
    });

    it('aplica a mesma regra condicional da estrutura', () => {
      expect(updateStoragePositionSchema.validate({ positionType: 'PISO' }).error).toBeUndefined();
      expect(updateStoragePositionSchema.validate({ positionType: 'RACKS' }).error).toBeDefined();
    });

    it('descarta campos de identidade enviados pelo cliente (stripUnknown do validate)', () => {
      // `code`, `structureId`, `floor` e `position` não são declarados no
      // schema — o middleware validate() roda com stripUnknown, então eles
      // simplesmente não chegam ao Prisma.
      const { error, value } = updateStoragePositionSchema.validate(
        { blocked: true, code: 'HACK-01-01-01', structureId: 'x', floor: 9 },
        { stripUnknown: true }
      );

      expect(error).toBeUndefined();
      expect(value).toEqual({ blocked: true });
    });
  });
});
