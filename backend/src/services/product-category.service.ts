import { prisma } from '../config/database';

export interface CreateProductCategoryDto {
  code: string;
  name: string;
  description?: string | null;
  parentId?: string | null;
}

export interface UpdateProductCategoryDto extends Partial<CreateProductCategoryDto> {}

export class ProductCategoryService {
  async create(data: CreateProductCategoryDto) {
    return prisma.productCategory.create({
      data,
    });
  }

  async getAll(page = 1, limit = 100, filters?: { search?: string; parentId?: string | null }) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filters?.search) {
      where.OR = [
        { code: { contains: filters.search } },
        { name: { contains: filters.search } },
        { description: { contains: filters.search } },
      ];
    }

    if (filters?.parentId === null) {
      where.parentId = null;
    } else if (filters?.parentId) {
      where.parentId = filters.parentId;
    }

    const [categories, total] = await Promise.all([
      prisma.productCategory.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          parent: { select: { id: true, code: true, name: true } },
          children: {
            select: { id: true, code: true, name: true },
          },
        },
      }),
      prisma.productCategory.count({ where }),
    ]);

    return {
      data: categories,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string) {
    return prisma.productCategory.findUnique({
      where: { id },
      include: {
        parent: { select: { id: true, code: true, name: true } },
        children: {
          select: { id: true, code: true, name: true },
        },
      },
    });
  }

  async update(id: string, data: UpdateProductCategoryDto) {
    return prisma.productCategory.update({
      where: { id },
      data,
      include: {
        parent: { select: { id: true, code: true, name: true } },
        children: {
          select: { id: true, code: true, name: true },
        },
      },
    });
  }

  async delete(id: string) {
    return prisma.productCategory.delete({ where: { id } });
  }
}

export default new ProductCategoryService();
