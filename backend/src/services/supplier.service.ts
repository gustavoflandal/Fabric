import { prisma } from '../config/database';

export interface CreateSupplierDto {
  code: string;
  name: string;
  legalName?: string;
  document?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  paymentTerms?: string;
  leadTime?: number;
  rating?: number;
  active?: boolean;
}

export interface UpdateSupplierDto extends Partial<CreateSupplierDto> {}

export class SupplierService {
  async create(data: CreateSupplierDto) {
    return await prisma.supplier.create({ data });
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
        { document: { contains: filters.search } },
        { email: { contains: filters.search } },
      ];
    }

    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      prisma.supplier.count({ where }),
    ]);

    return {
      data: suppliers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string) {
    return await prisma.supplier.findUnique({ where: { id } });
  }

  async update(id: string, data: UpdateSupplierDto) {
    return await prisma.supplier.update({ where: { id }, data });
  }

  async delete(id: string) {
    return await prisma.supplier.delete({ where: { id } });
  }

  async toggleActive(id: string) {
    const supplier = await this.getById(id);
    if (!supplier) throw new Error('Fornecedor não encontrado');
    return await this.update(id, { active: !supplier.active });
  }
}

export default new SupplierService();
