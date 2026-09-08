import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface CreateMaintenancePlanDto {
  equipmentId: string;
  name: string;
  description?: string | null;
  frequencyDays: number;
  nextDueDate?: Date | string;
  active?: boolean;
}

export interface UpdateMaintenancePlanDto extends Partial<CreateMaintenancePlanDto> {}

export interface MaintenancePlanFilters {
  equipmentId?: string;
  active?: boolean;
}

const assertEquipmentExists = async (equipmentId: string) => {
  const equipment = await prisma.equipment.findUnique({ where: { id: equipmentId } });
  if (!equipment) {
    throw new AppError(400, 'Equipamento informado não existe');
  }
};

export class MaintenancePlanService {
  async create(data: CreateMaintenancePlanDto) {
    await assertEquipmentExists(data.equipmentId);

    // `nextDueDate` explícito (ex.: primeira execução agendada para uma data
    // futura específica) tem prioridade; na ausência, o plano já nasce
    // vencendo em `frequencyDays` a partir de agora.
    const nextDueDate = data.nextDueDate
      ? new Date(data.nextDueDate)
      : new Date(Date.now() + data.frequencyDays * MS_PER_DAY);

    return prisma.maintenancePlan.create({
      data: {
        equipmentId: data.equipmentId,
        name: data.name,
        description: data.description ?? null,
        frequencyDays: data.frequencyDays,
        nextDueDate,
        active: data.active ?? true,
      },
    });
  }

  async getAll(page = 1, limit = 100, filters?: MaintenancePlanFilters) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filters?.equipmentId) where.equipmentId = filters.equipmentId;
    if (filters?.active !== undefined) where.active = filters.active;

    const [plans, total] = await Promise.all([
      prisma.maintenancePlan.findMany({
        where,
        skip,
        take: limit,
        orderBy: { nextDueDate: 'asc' },
        include: { equipment: { select: { id: true, code: true, name: true } } },
      }),
      prisma.maintenancePlan.count({ where }),
    ]);

    return { data: plans, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async getById(id: string) {
    return prisma.maintenancePlan.findUnique({
      where: { id },
      include: { equipment: { select: { id: true, code: true, name: true } } },
    });
  }

  async update(id: string, data: UpdateMaintenancePlanDto) {
    if (data.equipmentId) {
      await assertEquipmentExists(data.equipmentId);
    }
    const { nextDueDate, ...rest } = data;
    return prisma.maintenancePlan.update({
      where: { id },
      data: { ...rest, ...(nextDueDate ? { nextDueDate: new Date(nextDueDate) } : {}) },
    });
  }

  async delete(id: string) {
    // A guarda também evita que `onDelete: SetNull` corrompa a convenção de
    // que `planId` nulo identifica uma ordem corretiva (spec §1) — excluir um
    // plano com ordens vinculadas faria essas ordens preventivas "virarem"
    // corretivas silenciosamente.
    const orderCount = await prisma.maintenanceOrder.count({ where: { planId: id } });
    if (orderCount > 0) {
      throw new AppError(400, 'Não é possível excluir um plano com ordens de manutenção vinculadas');
    }
    return prisma.maintenancePlan.delete({ where: { id } });
  }

  async toggleActive(id: string) {
    const plan = await this.getById(id);
    if (!plan) throw new AppError(404, 'Plano de manutenção não encontrado');
    return this.update(id, { active: !plan.active });
  }
}

export default new MaintenancePlanService();
