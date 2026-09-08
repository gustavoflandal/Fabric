import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';

export interface CreateDriverDto {
  name: string;
  cpf: string;
  supplierId: string;
}

export interface UpdateDriverDto extends Partial<CreateDriverDto> {}

export interface DriverFilters {
  supplierId?: string;
  blocked?: boolean;
  search?: string;
}

const assertSupplierExists = async (supplierId: string) => {
  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) {
    throw new AppError(400, 'Fornecedor informado não existe');
  }
};

const assertCpfNotTaken = async (cpf: string, excludeId?: string) => {
  const existing = await prisma.driver.findFirst({
    where: { cpf, ...(excludeId ? { id: { not: excludeId } } : {}) },
  });
  if (existing) {
    throw new AppError(400, 'Já existe um motorista cadastrado com este CPF');
  }
};

export class DriverService {
  async create(data: CreateDriverDto) {
    await assertSupplierExists(data.supplierId);
    await assertCpfNotTaken(data.cpf);
    return prisma.driver.create({ data });
  }

  async getAll(page = 1, limit = 100, filters?: DriverFilters) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filters?.supplierId) where.supplierId = filters.supplierId;
    if (filters?.blocked !== undefined) where.blocked = filters.blocked;
    if (filters?.search) {
      where.OR = [{ name: { contains: filters.search } }, { cpf: { contains: filters.search } }];
    }

    const [drivers, total] = await Promise.all([
      prisma.driver.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: { supplier: { select: { id: true, code: true, name: true } } },
      }),
      prisma.driver.count({ where }),
    ]);

    return { data: drivers, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async getById(id: string) {
    return prisma.driver.findUnique({
      where: { id },
      include: { supplier: { select: { id: true, code: true, name: true } } },
    });
  }

  async update(id: string, data: UpdateDriverDto) {
    if (data.supplierId) {
      await assertSupplierExists(data.supplierId);
    }
    if (data.cpf) {
      await assertCpfNotTaken(data.cpf, id);
    }
    return prisma.driver.update({ where: { id }, data });
  }

  async delete(id: string) {
    return prisma.driver.delete({ where: { id } });
  }

  async setBlocked(id: string, blocked: boolean, blockedReason: string | null) {
    return prisma.driver.update({ where: { id }, data: { blocked, blockedReason: blocked ? blockedReason : null } });
  }
}

export default new DriverService();
