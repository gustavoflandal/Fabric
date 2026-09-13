import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';

export interface CreateYardAreaDto {
  warehouseId: string;
  code: string;
  name: string;
}

export interface UpdateYardAreaDto {
  code?: string;
  name?: string;
}

export interface YardAreaFilters {
  warehouseId?: string;
  blocked?: boolean;
}

const assertWarehouseExists = async (warehouseId: string) => {
  const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
  if (!warehouse) throw new AppError(400, 'Armazém informado não existe');
};

const assertCodeUniqueInWarehouse = async (warehouseId: string, code: string, excludeId?: string) => {
  const existing = await prisma.yardArea.findFirst({
    where: { warehouseId, code, ...(excludeId ? { id: { not: excludeId } } : {}) },
  });
  if (existing) throw new AppError(400, 'Já existe uma área com este código neste armazém');
};

export class YardAreaService {
  async create(data: CreateYardAreaDto) {
    await assertWarehouseExists(data.warehouseId);
    await assertCodeUniqueInWarehouse(data.warehouseId, data.code);
    return prisma.yardArea.create({ data });
  }

  async getAll(page = 1, limit = 100, filters?: YardAreaFilters) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (filters?.warehouseId) where.warehouseId = filters.warehouseId;
    if (filters?.blocked !== undefined) where.blocked = filters.blocked;

    const [areas, total] = await Promise.all([
      prisma.yardArea.findMany({
        where,
        skip,
        take: limit,
        orderBy: { code: 'asc' },
        include: { warehouse: { select: { id: true, code: true, name: true } }, _count: { select: { spots: true } } },
      }),
      prisma.yardArea.count({ where }),
    ]);

    return { data: areas, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async getById(id: string) {
    return prisma.yardArea.findUnique({
      where: { id },
      include: { warehouse: { select: { id: true, code: true, name: true } }, _count: { select: { spots: true } } },
    });
  }

  async update(id: string, data: UpdateYardAreaDto) {
    const current = await prisma.yardArea.findUnique({ where: { id } });
    if (!current) throw new AppError(404, 'Área não encontrada');
    if (data.code) await assertCodeUniqueInWarehouse(current.warehouseId, data.code, id);
    return prisma.yardArea.update({ where: { id }, data });
  }

  async delete(id: string) {
    const spotCount = await prisma.yardSpot.count({ where: { areaId: id } });
    if (spotCount > 0) {
      throw new AppError(400, 'Não é possível excluir uma área com vagas cadastradas');
    }
    return prisma.yardArea.delete({ where: { id } });
  }

  async setBlocked(id: string, blocked: boolean, blockedReason: string | null) {
    return prisma.yardArea.update({ where: { id }, data: { blocked, blockedReason: blocked ? blockedReason : null } });
  }
}

export default new YardAreaService();
