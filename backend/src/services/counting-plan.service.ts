import { PrismaClient, CountingPlan, CountingType, CountingFrequency, CountingPlanStatus } from '@prisma/client';

const prisma = new PrismaClient();

export interface CreateCountingPlanDTO {
  name: string;
  description?: string;
  type: CountingType;
  frequency?: CountingFrequency;
  criteria?: any;
  allowBlindCount?: boolean;
  requireRecount?: boolean;
  tolerancePercent?: number;
  toleranceQty?: number;
  startDate: Date;
  endDate?: Date;
  createdBy: string;
}

export interface UpdateCountingPlanDTO {
  name?: string;
  description?: string;
  type?: CountingType;
  frequency?: CountingFrequency;
  criteria?: any;
  allowBlindCount?: boolean;
  requireRecount?: boolean;
  tolerancePercent?: number;
  toleranceQty?: number;
  startDate?: Date;
  endDate?: Date;
}

export interface CountingPlanFilters {
  status?: CountingPlanStatus;
  type?: CountingType;
  frequency?: CountingFrequency;
  search?: string;
}

class CountingPlanService {
  /**
   * Listar todos os planos de contagem
   */
  async findAll(filters?: CountingPlanFilters) {
    const where: any = {};

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.frequency) {
      where.frequency = filters.frequency;
    }

    if (filters?.search) {
      where.OR = [
        { code: { contains: filters.search } },
        { name: { contains: filters.search } },
        { description: { contains: filters.search } },
      ];
    }

    return await prisma.countingPlan.findMany({
      where,
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            sessions: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Buscar plano por ID
   */
  async findById(id: string) {
    return await prisma.countingPlan.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        sessions: {
          orderBy: {
            scheduledDate: 'desc',
          },
          take: 10,
        },
      },
    });
  }

  /**
   * Criar novo plano de contagem
   */
  async create(data: CreateCountingPlanDTO): Promise<CountingPlan> {
    // Gerar código único
    const count = await prisma.countingPlan.count();
    const code = `CONT-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;

    // Calcular próxima execução
    const nextExecution = this.calculateNextExecution(data.startDate, data.frequency);

    return await prisma.countingPlan.create({
      data: {
        code,
        name: data.name,
        description: data.description,
        type: data.type,
        frequency: data.frequency,
        criteria: data.criteria || {},
        allowBlindCount: data.allowBlindCount ?? true,
        requireRecount: data.requireRecount ?? true,
        tolerancePercent: data.tolerancePercent,
        toleranceQty: data.toleranceQty,
        startDate: data.startDate,
        endDate: data.endDate,
        nextExecution,
        createdBy: data.createdBy,
        status: 'DRAFT',
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Atualizar plano de contagem
   */
  async update(id: string, data: UpdateCountingPlanDTO): Promise<CountingPlan> {
    const plan = await this.findById(id);
    if (!plan) {
      throw new Error('Plano de contagem não encontrado');
    }

    // Recalcular próxima execução se frequência mudou
    let nextExecution = plan.nextExecution;
    if (data.frequency && data.frequency !== plan.frequency) {
      nextExecution = this.calculateNextExecution(data.startDate || plan.startDate, data.frequency);
    }

    return await prisma.countingPlan.update({
      where: { id },
      data: {
        ...data,
        nextExecution,
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Ativar plano de contagem
   */
  async activate(id: string): Promise<CountingPlan> {
    const plan = await this.findById(id);
    if (!plan) {
      throw new Error('Plano de contagem não encontrado');
    }

    if (plan.status === 'ACTIVE') {
      throw new Error('Plano já está ativo');
    }

    return await prisma.countingPlan.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        nextExecution: this.calculateNextExecution(new Date(), plan.frequency),
      },
    });
  }

  /**
   * Pausar plano de contagem
   */
  async pause(id: string): Promise<CountingPlan> {
    return await prisma.countingPlan.update({
      where: { id },
      data: {
        status: 'PAUSED',
      },
    });
  }

  /**
   * Cancelar plano de contagem
   */
  async cancel(id: string): Promise<CountingPlan> {
    return await prisma.countingPlan.update({
      where: { id },
      data: {
        status: 'CANCELLED',
      },
    });
  }

  /**
   * Deletar plano de contagem
   */
  async delete(id: string): Promise<void> {
    const plan = await this.findById(id);
    if (!plan) {
      throw new Error('Plano de contagem não encontrado');
    }

    // Verificar se tem sessões
    if (plan.sessions && plan.sessions.length > 0) {
      throw new Error('Não é possível deletar plano com sessões vinculadas');
    }

    await prisma.countingPlan.delete({
      where: { id },
    });
  }

  /**
   * Selecionar produtos baseado nos critérios do plano
   */
  async selectProducts(planId: string) {
    const plan = await this.findById(planId);
    if (!plan) {
      throw new Error('Plano de contagem não encontrado');
    }

    const criteria = plan.criteria as any;
    const where: any = { active: true };

    // Por tipo de produto
    if (criteria.productTypes && criteria.productTypes.length > 0) {
      where.type = { in: criteria.productTypes };
    }

    // Por categoria
    if (criteria.categories && criteria.categories.length > 0) {
      where.categoryId = { in: criteria.categories };
    }

    // Por criticidade (estoque baixo)
    if (criteria.criticality) {
      if (criteria.criticality.includes('CRITICAL')) {
        where.OR = where.OR || [];
        where.OR.push({
          minStock: { gt: 0 },
          // Assumindo que há um campo currentStock no Product
        });
      }
    }

    // Por valor
    if (criteria.minValue || criteria.maxValue) {
      where.standardCost = {};
      if (criteria.minValue) {
        where.standardCost.gte = criteria.minValue;
      }
      if (criteria.maxValue) {
        where.standardCost.lte = criteria.maxValue;
      }
    }

    // Produtos específicos
    if (criteria.productIds && criteria.productIds.length > 0) {
      where.id = { in: criteria.productIds };
    }

    return await prisma.product.findMany({
      where,
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        minStock: true,
        maxStock: true,
        standardCost: true,
      },
    });
  }

  /**
   * Calcular próxima data de execução
   */
  private calculateNextExecution(startDate: Date, frequency?: CountingFrequency): Date | null {
    if (!frequency || frequency === 'ON_DEMAND') {
      return null;
    }

    const next = new Date(startDate);

    switch (frequency) {
      case 'DAILY':
        next.setDate(next.getDate() + 1);
        break;
      case 'WEEKLY':
        next.setDate(next.getDate() + 7);
        break;
      case 'BIWEEKLY':
        next.setDate(next.getDate() + 14);
        break;
      case 'MONTHLY':
        next.setMonth(next.getMonth() + 1);
        break;
      case 'QUARTERLY':
        next.setMonth(next.getMonth() + 3);
        break;
      case 'SEMIANNUAL':
        next.setMonth(next.getMonth() + 6);
        break;
      case 'ANNUAL':
        next.setFullYear(next.getFullYear() + 1);
        break;
    }

    return next;
  }

  /**
   * Buscar planos que devem gerar sessões hoje
   */
  async findPlansToExecute() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return await prisma.countingPlan.findMany({
      where: {
        status: 'ACTIVE',
        nextExecution: {
          gte: today,
          lt: tomorrow,
        },
      },
      include: {
        creator: true,
      },
    });
  }

  /**
   * Atualizar próxima execução após gerar sessão
   */
  async updateNextExecution(id: string) {
    const plan = await this.findById(id);
    if (!plan) {
      throw new Error('Plano não encontrado');
    }

    const nextExecution = this.calculateNextExecution(new Date(), plan.frequency);

    return await prisma.countingPlan.update({
      where: { id },
      data: { nextExecution },
    });
  }
}

export default new CountingPlanService();
