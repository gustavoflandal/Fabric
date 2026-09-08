import { MaintenanceOrderStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';

export interface CreateCorrectiveOrderDto {
  equipmentId: string;
  problemDescription: string;
  assignedTo?: string | null;
}

export interface MaintenanceOrderFilters {
  equipmentId?: string;
  type?: 'PREVENTIVE' | 'CORRECTIVE';
  status?: MaintenanceOrderStatus;
}

const orderInclude = {
  equipment: { select: { id: true, code: true, name: true } },
  plan: { select: { id: true, name: true } },
  assignee: { select: { id: true, name: true, email: true } },
} as const;

const assertEquipmentExists = async (equipmentId: string) => {
  const equipment = await prisma.equipment.findUnique({ where: { id: equipmentId } });
  if (!equipment) {
    throw new AppError(400, 'Equipamento informado não existe');
  }
};

export class MaintenanceOrderService {
  async createCorrective(data: CreateCorrectiveOrderDto) {
    await assertEquipmentExists(data.equipmentId);

    return prisma.maintenanceOrder.create({
      data: {
        equipmentId: data.equipmentId,
        type: 'CORRECTIVE',
        status: 'PENDING',
        problemDescription: data.problemDescription,
        assignedTo: data.assignedTo ?? null,
      },
      include: orderInclude,
    });
  }

  /**
   * Chamada só pelo job de manutenção (Task 5) — nunca por uma rota HTTP.
   * `planId` sempre preenchido, `type` sempre PREVENTIVE.
   */
  async createPreventiveFromPlan(planId: string) {
    const plan = await prisma.maintenancePlan.findUnique({ where: { id: planId } });
    if (!plan) {
      throw new AppError(404, 'Plano de manutenção não encontrado');
    }

    return prisma.maintenanceOrder.create({
      data: {
        equipmentId: plan.equipmentId,
        planId: plan.id,
        type: 'PREVENTIVE',
        status: 'PENDING',
      },
      include: orderInclude,
    });
  }

  /** Existe uma ordem PENDING/IN_PROGRESS ainda aberta para este plano? */
  async hasOpenOrderForPlan(planId: string): Promise<boolean> {
    const count = await prisma.maintenanceOrder.count({
      where: { planId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
    });
    return count > 0;
  }

  async getAll(page = 1, limit = 100, filters?: MaintenanceOrderFilters) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filters?.equipmentId) where.equipmentId = filters.equipmentId;
    if (filters?.type) where.type = filters.type;
    if (filters?.status) where.status = filters.status;

    const [orders, total] = await Promise.all([
      prisma.maintenanceOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: orderInclude,
      }),
      prisma.maintenanceOrder.count({ where }),
    ]);

    return { data: orders, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async getById(id: string) {
    return prisma.maintenanceOrder.findUnique({ where: { id }, include: orderInclude });
  }

  private async getOrThrow(id: string) {
    const order = await prisma.maintenanceOrder.findUnique({ where: { id } });
    if (!order) throw new AppError(404, 'Ordem de manutenção não encontrada');
    return order;
  }

  async start(id: string) {
    const order = await this.getOrThrow(id);
    if (order.status !== 'PENDING') {
      throw new AppError(400, `Ordem não está pendente (status atual: ${order.status})`);
    }
    return prisma.maintenanceOrder.update({
      where: { id },
      data: { status: 'IN_PROGRESS', startedAt: new Date() },
      include: orderInclude,
    });
  }

  async complete(id: string, resolutionNotes: string) {
    const order = await this.getOrThrow(id);
    if (order.status !== 'IN_PROGRESS') {
      throw new AppError(400, `Ordem não está em execução (status atual: ${order.status})`);
    }
    return prisma.maintenanceOrder.update({
      where: { id },
      data: { status: 'COMPLETED', completedAt: new Date(), resolutionNotes },
      include: orderInclude,
    });
  }

  async cancel(id: string, reason?: string | null) {
    const order = await this.getOrThrow(id);
    if (order.status !== 'PENDING' && order.status !== 'IN_PROGRESS') {
      throw new AppError(400, `Ordem não pode ser cancelada (status atual: ${order.status})`);
    }
    return prisma.maintenanceOrder.update({
      where: { id },
      data: { status: 'CANCELLED', resolutionNotes: reason ?? undefined },
      include: orderInclude,
    });
  }

  async updateAssignee(id: string, assignedTo: string | null) {
    await this.getOrThrow(id);
    return prisma.maintenanceOrder.update({
      where: { id },
      data: { assignedTo },
      include: orderInclude,
    });
  }
}

export default new MaintenanceOrderService();
