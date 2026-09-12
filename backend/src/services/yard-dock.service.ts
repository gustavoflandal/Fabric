import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';

export interface CreateYardDockDto {
  code: string;
  serviceType: 'RECEBIMENTO' | 'EXPEDICAO' | 'MULTIUSO';
  warehouseId: string;
  storagePositionId?: string | null;
  active?: boolean;
}

export interface UpdateYardDockDto extends Partial<Omit<CreateYardDockDto, 'warehouseId'>> {}

export interface YardDockFilters {
  warehouseId?: string;
  serviceType?: 'RECEBIMENTO' | 'EXPEDICAO' | 'MULTIUSO';
  active?: boolean;
}

const assertWarehouseExists = async (warehouseId: string) => {
  const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
  if (!warehouse) {
    throw new AppError(400, 'Armazém informado não existe');
  }
};

const assertStoragePositionIsDock = async (storagePositionId: string) => {
  const position = await prisma.storagePosition.findUnique({ where: { id: storagePositionId } });
  if (!position) {
    throw new AppError(400, 'Posição de armazenagem informada não existe');
  }
  if (position.positionType !== 'DOCA') {
    throw new AppError(400, 'A posição informada não é do tipo DOCA');
  }
};

const assertCodeUniqueInWarehouse = async (warehouseId: string, code: string, excludeId?: string) => {
  const existing = await prisma.yardDock.findFirst({
    where: { warehouseId, code, ...(excludeId ? { id: { not: excludeId } } : {}) },
  });
  if (existing) {
    throw new AppError(400, 'Já existe uma doca com este código neste armazém');
  }
};

const assertStoragePositionNotLinked = async (storagePositionId: string, excludeId?: string) => {
  const existing = await prisma.yardDock.findFirst({
    where: { storagePositionId, ...(excludeId ? { id: { not: excludeId } } : {}) },
  });
  if (existing) {
    throw new AppError(400, 'Esta posição de armazenagem já está vinculada a outra doca');
  }
};

export class YardDockService {
  async create(data: CreateYardDockDto) {
    await assertWarehouseExists(data.warehouseId);
    if (data.storagePositionId) {
      await assertStoragePositionIsDock(data.storagePositionId);
      await assertStoragePositionNotLinked(data.storagePositionId);
    }
    await assertCodeUniqueInWarehouse(data.warehouseId, data.code);
    return prisma.yardDock.create({ data });
  }

  async getAll(page = 1, limit = 100, filters?: YardDockFilters) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filters?.warehouseId) where.warehouseId = filters.warehouseId;
    if (filters?.serviceType) where.serviceType = filters.serviceType;
    if (filters?.active !== undefined) where.active = filters.active;

    const [docks, total] = await Promise.all([
      prisma.yardDock.findMany({
        where,
        skip,
        take: limit,
        orderBy: { code: 'asc' },
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
          storagePosition: { select: { id: true, code: true } },
        },
      }),
      prisma.yardDock.count({ where }),
    ]);

    return { data: docks, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async getById(id: string) {
    return prisma.yardDock.findUnique({
      where: { id },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        storagePosition: { select: { id: true, code: true } },
      },
    });
  }

  async update(id: string, data: UpdateYardDockDto) {
    const current = await prisma.yardDock.findUnique({ where: { id } });
    if (!current) throw new AppError(404, 'Doca não encontrada');

    if (data.storagePositionId) {
      await assertStoragePositionIsDock(data.storagePositionId);
      await assertStoragePositionNotLinked(data.storagePositionId, id);
    }
    if (data.code) {
      await assertCodeUniqueInWarehouse(current.warehouseId, data.code, id);
    }
    return prisma.yardDock.update({ where: { id }, data });
  }

  async delete(id: string) {
    return prisma.yardDock.delete({ where: { id } });
  }
}

export default new YardDockService();
