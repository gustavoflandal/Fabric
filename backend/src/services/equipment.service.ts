import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';

export interface CreateEquipmentDto {
  code: string;
  name: string;
  workCenterId: string;
  manufacturer?: string | null;
  model?: string | null;
  active?: boolean;
}

export interface UpdateEquipmentDto extends Partial<CreateEquipmentDto> {}

export interface EquipmentFilters {
  workCenterId?: string;
  active?: boolean;
  search?: string;
}

const assertWorkCenterExists = async (workCenterId: string) => {
  const workCenter = await prisma.workCenter.findUnique({ where: { id: workCenterId } });
  if (!workCenter) {
    throw new AppError(400, 'Centro de trabalho informado não existe');
  }
};

export class EquipmentService {
  async create(data: CreateEquipmentDto) {
    await assertWorkCenterExists(data.workCenterId);
    return prisma.equipment.create({ data });
  }

  async getAll(page = 1, limit = 100, filters?: EquipmentFilters) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filters?.workCenterId) where.workCenterId = filters.workCenterId;
    if (filters?.active !== undefined) where.active = filters.active;
    if (filters?.search) {
      where.OR = [
        { code: { contains: filters.search } },
        { name: { contains: filters.search } },
      ];
    }

    const [equipment, total] = await Promise.all([
      prisma.equipment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: { workCenter: { select: { id: true, code: true, name: true } } },
      }),
      prisma.equipment.count({ where }),
    ]);

    return { data: equipment, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async getById(id: string) {
    return prisma.equipment.findUnique({
      where: { id },
      include: { workCenter: { select: { id: true, code: true, name: true } } },
    });
  }

  async update(id: string, data: UpdateEquipmentDto) {
    if (data.workCenterId) {
      await assertWorkCenterExists(data.workCenterId);
    }
    return prisma.equipment.update({ where: { id }, data });
  }

  async delete(id: string) {
    return prisma.equipment.delete({ where: { id } });
  }

  async toggleActive(id: string) {
    const equipment = await this.getById(id);
    if (!equipment) throw new AppError(404, 'Equipamento não encontrado');
    return this.update(id, { active: !equipment.active });
  }
}

export default new EquipmentService();
