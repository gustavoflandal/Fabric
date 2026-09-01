import { prisma } from '../config/database';

export interface CreateWarehouseDto {
  code: string;
  name: string;
  description?: string;
  active?: boolean;
}

export interface UpdateWarehouseDto extends Partial<CreateWarehouseDto> {}

export class WarehouseService {
  async create(data: CreateWarehouseDto) {
    return await prisma.warehouse.create({ data });
  }

  async getAll(page = 1, limit = 100, filters?: {
    active?: boolean;
    search?: string;
  }) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filters?.active !== undefined) {
      where.active = filters.active;
    }

    if (filters?.search) {
      where.OR = [
        { code: { contains: filters.search } },
        { name: { contains: filters.search } },
      ];
    }

    const [data, total] = await prisma.$transaction([
      prisma.warehouse.findMany({ skip, take: limit, where, orderBy: { name: 'asc' } }),
      prisma.warehouse.count({ where }),
    ]);

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        lastPage: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string) {
    return await prisma.warehouse.findUnique({ where: { id } });
  }

  async update(id: string, data: UpdateWarehouseDto) {
    return await prisma.warehouse.update({ where: { id }, data });
  }

  async delete(id: string) {
    return await prisma.warehouse.delete({ where: { id } });
  }

  async toggleActive(id: string) {
    const warehouse = await this.getById(id);
    if (!warehouse) throw new Error('Armazém não encontrado');

    return await prisma.warehouse.update({
      where: { id },
      data: { active: !warehouse.active },
    });
  }
}

export default new WarehouseService();