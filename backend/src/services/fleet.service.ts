import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';

export interface CreateFleetDto {
  name: string;
  supplierId: string;
}

export interface UpdateFleetDto {
  name?: string;
}

export interface FleetFilters {
  supplierId?: string;
  blocked?: boolean;
}

const assertSupplierExists = async (supplierId: string) => {
  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) {
    throw new AppError(400, 'Fornecedor informado não existe');
  }
};

export class FleetService {
  async create(data: CreateFleetDto) {
    await assertSupplierExists(data.supplierId);
    return prisma.fleet.create({ data });
  }

  async getAll(page = 1, limit = 100, filters?: FleetFilters) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filters?.supplierId) where.supplierId = filters.supplierId;
    if (filters?.blocked !== undefined) where.blocked = filters.blocked;

    const [fleets, total] = await Promise.all([
      prisma.fleet.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: { supplier: { select: { id: true, code: true, name: true } }, _count: { select: { vehicles: true } } },
      }),
      prisma.fleet.count({ where }),
    ]);

    return { data: fleets, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async getById(id: string) {
    return prisma.fleet.findUnique({
      where: { id },
      include: { supplier: { select: { id: true, code: true, name: true } }, _count: { select: { vehicles: true } } },
    });
  }

  async update(id: string, data: UpdateFleetDto) {
    return prisma.fleet.update({ where: { id }, data });
  }

  async delete(id: string) {
    return prisma.fleet.delete({ where: { id } });
  }

  async setBlocked(id: string, blocked: boolean, blockedReason: string | null) {
    return prisma.fleet.update({ where: { id }, data: { blocked, blockedReason: blocked ? blockedReason : null } });
  }
}

export default new FleetService();
