import { prisma } from '../config/database';

// Service para gerenciar posições de armazenagem
export const generatePositions = async (structureId: string) => {
  // Buscar a estrutura
  const structure = await prisma.warehouseStructure.findUnique({
    where: { id: structureId },
    include: { warehouse: true }
  });

  if (!structure) {
    throw new Error('Estrutura não encontrada');
  }

  // Verificar se já existem posições
  const existingPositions = await prisma.storagePosition.count({
    where: { structureId }
  });

  if (existingPositions > 0) {
    throw new Error('Esta estrutura já possui posições geradas. Exclua as posições existentes antes de gerar novas.');
  }

  // Gerar as posições
  const positions = [];
  
  for (let floor = 1; floor <= structure.floors; floor++) {
    for (let position = 1; position <= structure.positions; position++) {
      positions.push({
        structureId: structure.id,
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

  // Criar as posições em lote
  const result = await prisma.storagePosition.createMany({
    data: positions
  });

  // Retornar as posições criadas
  return await prisma.storagePosition.findMany({
    where: { structureId },
    orderBy: [{ floor: 'asc' }, { position: 'asc' }]
  });
};

export const getPositionsByStructure = async (structureId: string) => {
  const positions = await prisma.storagePosition.findMany({
    where: { structureId },
    orderBy: [{ floor: 'asc' }, { position: 'asc' }]
  });

  // Adicionar o código gerado para cada posição
  return positions.map(pos => ({
    ...pos,
    code: `${pos.warehouseCode}-${pos.streetCode}-${pos.floor.toString().padStart(2, '0')}-${pos.position.toString().padStart(2, '0')}`
  }));
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
