import { prisma } from '../config/database';

export interface CreateCustomerDto {
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
  creditLimit?: number;
  active?: boolean;
}

export interface UpdateCustomerDto extends Partial<CreateCustomerDto> {}

export class CustomerService {
  async create(data: CreateCustomerDto) {
    return await prisma.customer.create({ data });
  }

  async getAll(page = 1, limit = 100, filters?: { active?: boolean; search?: string }) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filters?.active !== undefined) where.active = filters.active;
    if (filters?.search) {
      where.OR = [
        { code: { contains: filters.search } },
        { name: { contains: filters.search } },
        { document: { contains: filters.search } },
        { email: { contains: filters.search } },
      ];
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({ where, skip, take: limit, orderBy: { name: 'asc' } }),
      prisma.customer.count({ where }),
    ]);

    return { data: customers, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async getById(id: string) {
    return await prisma.customer.findUnique({ where: { id } });
  }

  async update(id: string, data: UpdateCustomerDto) {
    return await prisma.customer.update({ where: { id }, data });
  }

  async delete(id: string) {
    return await prisma.customer.delete({ where: { id } });
  }

  async toggleActive(id: string) {
    const customer = await this.getById(id);
    if (!customer) throw new Error('Cliente não encontrado');
    return await this.update(id, { active: !customer.active });
  }
}

export default new CustomerService();
