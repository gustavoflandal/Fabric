import { prisma } from '../config/database';

export interface CreateWorkCenterDto {
  code: string;
  name: string;
  description?: string;
  type: string;
  capacity?: number;
  efficiency?: number;
  costPerHour?: number;
  active?: boolean;
}

export interface UpdateWorkCenterDto extends Partial<CreateWorkCenterDto> {}

export class WorkCenterService {
  async create(data: CreateWorkCenterDto) {
    return await prisma.workCenter.create({ data });
  }

  async getAll(page = 1, limit = 100, filters?: { type?: string; active?: boolean; search?: string }) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filters?.type) where.type = filters.type;
    if (filters?.active !== undefined) where.active = filters.active;
    if (filters?.search) {
      where.OR = [
        { code: { contains: filters.search } },
        { name: { contains: filters.search } },
      ];
    }

    const [workCenters, total] = await Promise.all([
      prisma.workCenter.findMany({ where, skip, take: limit, orderBy: { name: 'asc' } }),
      prisma.workCenter.count({ where }),
    ]);

    return { data: workCenters, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async getById(id: string) {
    return await prisma.workCenter.findUnique({ where: { id } });
  }

  async update(id: string, data: UpdateWorkCenterDto) {
    return await prisma.workCenter.update({ where: { id }, data });
  }

  async delete(id: string) {
    return await prisma.workCenter.delete({ where: { id } });
  }

  async toggleActive(id: string) {
    const workCenter = await this.getById(id);
    if (!workCenter) throw new Error('Centro de trabalho não encontrado');
    return await this.update(id, { active: !workCenter.active });
  }
}

export default new WorkCenterService();
