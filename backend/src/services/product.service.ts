import { prisma } from '../config/database';

export interface CreateProductDto {
  code: string;
  name: string;
  description?: string;
  type: string;
  unitId: string;
  categoryId?: string;
  leadTime?: number;
  lotSize?: number;
  minStock?: number;
  maxStock?: number;
  safetyStock?: number;
  reorderPoint?: number;
  standardCost?: number;
  lastCost?: number;
  averageCost?: number;
  active?: boolean;
}

export interface UpdateProductDto extends Partial<CreateProductDto> {}

export class ProductService {
  async create(data: CreateProductDto) {
    return await prisma.product.create({
      data,
      include: { unit: true, category: true },
    });
  }

  async getAll(page = 1, limit = 100, filters?: {
    type?: string;
    categoryId?: string;
    active?: boolean;
    search?: string;
  }) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filters?.type) where.type = filters.type;
    if (filters?.categoryId) where.categoryId = filters.categoryId;
    if (filters?.active !== undefined) where.active = filters.active;
    if (filters?.search) {
      where.OR = [
        { code: { contains: filters.search } },
        { name: { contains: filters.search } },
        { description: { contains: filters.search } },
      ];
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: { unit: true, category: true },
      }),
      prisma.product.count({ where }),
    ]);

    return {
      data: products,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async getById(id: string) {
    return await prisma.product.findUnique({
      where: { id },
      include: { unit: true, category: true },
    });
  }

  async update(id: string, data: UpdateProductDto) {
    return await prisma.product.update({
      where: { id },
      data,
      include: { unit: true, category: true },
    });
  }

  async delete(id: string) {
    return await prisma.product.delete({ where: { id } });
  }

  async toggleActive(id: string) {
    const product = await this.getById(id);
    if (!product) throw new Error('Produto não encontrado');
    return await this.update(id, { active: !product.active });
  }
}

export default new ProductService();
