import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';

/**
 * F0.1 do plano do WMS: formato canônico do endereço de uma posição
 * (`ARM-RUA-AA-PP`). Antes essa concatenação vivia dentro de
 * getPositionsByStructure() e o resultado nunca era persistido — não dava para
 * buscar por código, indexar, nem pendurar saldo/movimento/etiqueta nele.
 *
 * Ponto único de verdade do formato: a coluna `storage_positions.code` é
 * gravada por aqui na criação, e o backfill da migration
 * `20260901230000_fase0_wms_fundacao` reproduz exatamente esta mesma regra em SQL.
 */
export const buildPositionCode = (parts: {
  warehouseCode: string;
  streetCode: string;
  floor: number;
  position: number;
}): string =>
  `${parts.warehouseCode}-${parts.streetCode}-` +
  `${parts.floor.toString().padStart(2, '0')}-` +
  `${parts.position.toString().padStart(2, '0')}`;

// Service para gerenciar posições de armazenagem
export const generatePositions = async (structureId: string) => {
  // Buscar a estrutura
  const structure = await prisma.warehouseStructure.findUnique({
    where: { id: structureId },
    include: { warehouse: true }
  });

  if (!structure) {
    throw new AppError(404, 'Estrutura não encontrada');
  }

  // Verificar se já existem posições
  const existingPositions = await prisma.storagePosition.count({
    where: { structureId }
  });

  if (existingPositions > 0) {
    throw new AppError(409, 'Esta estrutura já possui posições geradas. Exclua as posições existentes antes de gerar novas.');
  }

  // Gerar as posições
  const positions = [];
  
  for (let floor = 1; floor <= structure.floors; floor++) {
    for (let position = 1; position <= structure.positions; position++) {
      positions.push({
        structureId: structure.id,
        code: buildPositionCode({
          warehouseCode: structure.warehouse.code,
          streetCode: structure.streetCode,
          floor,
          position,
        }),
        warehouseCode: structure.warehouse.code,
        streetCode: structure.streetCode,
        floor,
        position,
        positionType: structure.positionType,
        weightCapacity: structure.weightCapacity,
        height: structure.height,
        width: structure.width,
        depth: structure.depth,
        maxHeight: structure.maxHeight,
        blocked: structure.blocked
      });
    }
  }

  // Criar as posições em lote.
  // F0.1: `code` é único GLOBALMENTE (é o endereço que o operador lê na
  // etiqueta), enquanto o banco só garantia unicidade de (estrutura, andar,
  // posição). Duas estruturas do mesmo armazém cadastradas com o mesmo
  // streetCode geram exatamente os mesmos endereços e colidem aqui — o que é a
  // resposta certa (dois lugares físicos não podem ter o mesmo endereço), mas
  // precisa sair como erro de negócio, e não como um P2002 cru do Prisma.
  try {
    await prisma.storagePosition.createMany({
      data: positions
    });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      throw new AppError(
        409,
        `Já existem posições com estes endereços (${structure.warehouse.code}-${structure.streetCode}-...). ` +
          'Verifique se outra estrutura deste armazém usa o mesmo código de rua.'
      );
    }
    throw error;
  }

  // Retornar as posições criadas
  return await prisma.storagePosition.findMany({
    where: { structureId },
    orderBy: [{ floor: 'asc' }, { position: 'asc' }]
  });
};

// F0.1: `code` agora vem da coluna persistida — não é mais concatenado em
// memória a cada leitura. O contrato de retorno é o mesmo de antes (o objeto
// continua tendo `code`), só a origem do valor mudou.
export const getPositionsByStructure = async (structureId: string) => {
  return await prisma.storagePosition.findMany({
    where: { structureId },
    orderBy: [{ floor: 'asc' }, { position: 'asc' }]
  });
};

/**
 * F0.2 do plano do WMS: busca de posição pelo endereço.
 * Pré-requisito de qualquer operação com coletor/scanner — o operador lê a
 * etiqueta da posição e o sistema precisa resolver isso para uma posição.
 */
export const getPositionByCode = async (code: string) => {
  const position = await prisma.storagePosition.findUnique({
    where: { code: code.trim().toUpperCase() },
    include: {
      structure: {
        include: { warehouse: true }
      }
    }
  });

  if (!position) {
    throw new AppError(404, `Posição de armazenagem não encontrada para o código ${code}`);
  }

  return position;
};

export const deletePositionsByStructure = async (structureId: string) => {
  const result = await prisma.storagePosition.deleteMany({
    where: { structureId }
  });

  return result.count;
};

export const updatePosition = async (positionId: string, data: any) => {
  return await prisma.storagePosition.update({
    where: { id: positionId },
    data
  });
};

export const deletePosition = async (positionId: string) => {
  return await prisma.storagePosition.delete({
    where: { id: positionId }
  });
};
