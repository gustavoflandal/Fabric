import { prisma } from '../config/database';

export interface CreateUnitOfMeasureDto {
  code: string;
  name: string;
  type: string;
  symbol?: string;
  active?: boolean;
}

export interface UpdateUnitOfMeasureDto {
  code?: string;
  name?: string;
  type?: string;
  symbol?: string;
  active?: boolean;
}

export class UnitOfMeasureService {
  async create(data: CreateUnitOfMeasureDto) {
    return await prisma.unitOfMeasure.create({
      data,
    });
  }

  async getAll(page = 1, limit = 100, filters?: {
    type?: string;
    active?: boolean;
    search?: string;
  }) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.active !== undefined) {
      where.active = filters.active;
    }

    if (filters?.search) {
      where.OR = [
        { code: { contains: filters.search } },
        { name: { contains: filters.search } },
        { symbol: { contains: filters.search } },
      ];
    }

    const [units, total] = await Promise.all([
      prisma.unitOfMeasure.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      prisma.unitOfMeasure.count({ where }),
    ]);

    return {
      data: units,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string) {
    return await prisma.unitOfMeasure.findUnique({
      where: { id },
    });
  }

  async getByCode(code: string) {
    return await prisma.unitOfMeasure.findUnique({
      where: { code },
    });
  }

  async update(id: string, data: UpdateUnitOfMeasureDto) {
    return await prisma.unitOfMeasure.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return await prisma.unitOfMeasure.delete({
      where: { id },
    });
  }

  async toggleActive(id: string) {
    const unit = await this.getById(id);
    if (!unit) {
      throw new Error('Unidade de medida não encontrada');
    }

    return await this.update(id, { active: !unit.active });
  }
}

export default new UnitOfMeasureService();
