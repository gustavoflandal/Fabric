import { PrismaClient } from '@prisma/client';
import { assertPositionsDeletable } from './storage-position.service';

const prisma = new PrismaClient();

export class WarehouseStructureService {
  async create(data) {
    return await prisma.warehouseStructure.create({ data });
  }

  async getAll(page, limit, filters) {
    const where = {
      blocked: filters.blocked,
      OR: filters.search
        ? [
            { streetCode: { contains: filters.search } },
            { warehouse: { name: { contains: filters.search } } },
          ]
        : undefined,
    };

    const [data, total] = await Promise.all([
      prisma.warehouseStructure.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: { 
          warehouse: true,
          _count: {
            select: { storagePositions: true }
          }
        },
      }),
      prisma.warehouseStructure.count({ where }),
    ]);

    // Adicionar contagem de posições geradas a cada estrutura
    const dataWithCount = data.map(structure => {
      const { _count, ...rest } = structure;
      return {
        ...rest,
        generatedPositionsCount: _count?.storagePositions || 0,
      };
    });

    return {
      data: dataWithCount,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id) {
    return await prisma.warehouseStructure.findUnique({
      where: { id },
      include: { warehouse: true },
    });
  }

  async update(id, data) {
    // Filtrar apenas os campos permitidos para atualização
    const allowedFields = {
      warehouseId: data.warehouseId,
      streetCode: data.streetCode,
      floors: data.floors,
      positions: data.positions,
      weightCapacity: data.weightCapacity,
      height: data.height,
      width: data.width,
      depth: data.depth,
      maxHeight: data.maxHeight,
      blocked: data.blocked,
      positionType: data.positionType,
    };

    // Remover campos undefined
    Object.keys(allowedFields).forEach(key => 
      allowedFields[key] === undefined && delete allowedFields[key]
    );

    return await prisma.warehouseStructure.update({
      where: { id },
      data: allowedFields,
    });
  }

  async delete(id) {
    // F1.1 do plano do WMS: `storage_positions.structureId` tem ON DELETE
    // CASCADE (estrutura -> posições, vindo da Fase 0), mas a partir da Fase 1
    // as posições são referenciadas por `stock_position_balances` e
    // `stock_movements.positionId` com FK RESTRICT. Resultado: apagar uma
    // estrutura cujas posições tenham saldo ou histórico falha no banco. Sem
    // esta guarda, isso vazaria como um P2003 cru (500) em vez de dizer ao
    // usuário o que está no caminho.
    await assertPositionsDeletable({ structureId: id });

    return await prisma.warehouseStructure.delete({
      where: { id },
    });
  }
}

export default new WarehouseStructureService();