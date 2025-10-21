import { PrismaClient, CountingSession, SessionStatus } from '@prisma/client';
import countingPlanService from './counting-plan.service';

const prisma = new PrismaClient();

export interface CreateSessionDTO {
  planId: string;
  scheduledDate: Date;
  assignedTo?: string;
}

export interface SessionFilters {
  status?: SessionStatus;
  planId?: string;
  assignedTo?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

class CountingSessionService {
  /**
   * Listar todas as sessões
   */
  async findAll(filters?: SessionFilters) {
    const where: any = {};

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.planId) {
      where.planId = filters.planId;
    }

    if (filters?.assignedTo) {
      where.assignedTo = filters.assignedTo;
    }

    if (filters?.dateFrom || filters?.dateTo) {
      where.scheduledDate = {};
      if (filters.dateFrom) {
        where.scheduledDate.gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        where.scheduledDate.lte = filters.dateTo;
      }
    }

    return await prisma.countingSession.findMany({
      where,
      include: {
        plan: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
          },
        },
        assignedUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        completedUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            items: true,
          },
        },
      },
      orderBy: {
        scheduledDate: 'desc',
      },
    });
  }

  /**
   * Buscar sessão por ID
   */
  async findById(id: string) {
    return await prisma.countingSession.findUnique({
      where: { id },
      include: {
        plan: true,
        assignedUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        completedUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                code: true,
                name: true,
                type: true,
                unitId: true,
              },
            },
            location: true,
            counter: {
              select: {
                id: true,
                name: true,
              },
            },
            recounter: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });
  }

  /**
   * Criar nova sessão de contagem
   */
  async create(data: CreateSessionDTO): Promise<CountingSession> {
    const plan = await countingPlanService.findById(data.planId);
    if (!plan) {
      throw new Error('Plano de contagem não encontrado');
    }

    if (plan.status !== 'ACTIVE') {
      throw new Error('Plano de contagem não está ativo');
    }

    // Gerar código único
    const count = await prisma.countingSession.count();
    const code = `SESS-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    // Selecionar produtos baseado nos critérios do plano
    const products = await countingPlanService.selectProducts(data.planId);

    // Criar sessão
    const session = await prisma.countingSession.create({
      data: {
        code,
        planId: data.planId,
        scheduledDate: data.scheduledDate,
        assignedTo: data.assignedTo,
        status: 'SCHEDULED',
        totalItems: products.length,
      },
    });

    // Criar itens de contagem
    await prisma.countingItem.createMany({
      data: products.map((product) => ({
        sessionId: session.id,
        productId: product.id,
        systemQty: 0, // Será atualizado ao iniciar a sessão
        status: 'PENDING',
      })),
    });

    return session;
  }

  /**
   * Iniciar sessão de contagem
   */
  async start(id: string, userId: string): Promise<CountingSession> {
    const session = await this.findById(id);
    if (!session) {
      throw new Error('Sessão não encontrada');
    }

    if (session.status !== 'SCHEDULED') {
      throw new Error('Sessão não pode ser iniciada');
    }

    // Atualizar quantidades do sistema nos itens
    for (const item of session.items) {
      // Buscar estoque atual do produto
      const movements = await prisma.stockMovement.findMany({
        where: { productId: item.productId },
        select: {
          type: true,
          quantity: true,
        },
      });

      // Calcular estoque atual
      let currentStock = 0;
      for (const movement of movements) {
        if (movement.type === 'IN' || movement.type === 'ADJUSTMENT') {
          currentStock += movement.quantity;
        } else if (movement.type === 'OUT') {
          currentStock -= movement.quantity;
        }
      }

      // Atualizar item
      await prisma.countingItem.update({
        where: { id: item.id },
        data: { systemQty: currentStock },
      });
    }

    return await prisma.countingSession.update({
      where: { id },
      data: {
        status: 'IN_PROGRESS',
        startedAt: new Date(),
        assignedTo: userId,
      },
    });
  }

  /**
   * Completar sessão de contagem
   */
  async complete(id: string, userId: string): Promise<CountingSession> {
    const session = await this.findById(id);
    if (!session) {
      throw new Error('Sessão não encontrada');
    }

    if (session.status !== 'IN_PROGRESS') {
      throw new Error('Sessão não está em andamento');
    }

    // Verificar se todos os itens foram contados
    const pendingItems = session.items.filter((item) => item.status === 'PENDING');
    if (pendingItems.length > 0) {
      throw new Error(`Ainda há ${pendingItems.length} itens pendentes de contagem`);
    }

    // Calcular estatísticas
    const countedItems = session.items.length;
    const itemsWithDiff = session.items.filter((item) => item.hasDifference).length;
    const accuracyPercent = ((countedItems - itemsWithDiff) / countedItems) * 100;

    return await prisma.countingSession.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        completedBy: userId,
        countedItems,
        itemsWithDiff,
        accuracyPercent,
      },
    });
  }

  /**
   * Cancelar sessão de contagem
   */
  async cancel(id: string): Promise<CountingSession> {
    return await prisma.countingSession.update({
      where: { id },
      data: {
        status: 'CANCELLED',
      },
    });
  }

  /**
   * Gerar relatório de divergências
   */
  async generateReport(id: string) {
    const session = await this.findById(id);
    if (!session) {
      throw new Error('Sessão não encontrada');
    }

    const itemsWithDiff = session.items.filter((item) => item.hasDifference);

    // Calcular totais
    const totalDifferenceValue = itemsWithDiff.reduce((sum, item) => {
      const product = item.product as any;
      const diffValue = Math.abs(Number(item.difference)) * (product.standardCost || 0);
      return sum + diffValue;
    }, 0);

    // Agrupar por tipo de divergência
    const shortages = itemsWithDiff.filter((item) => Number(item.difference) < 0);
    const surpluses = itemsWithDiff.filter((item) => Number(item.difference) > 0);

    return {
      session: {
        code: session.code,
        planName: session.plan.name,
        scheduledDate: session.scheduledDate,
        completedAt: session.completedAt,
        assignedUser: session.assignedUser?.name,
        completedUser: session.completedUser?.name,
      },
      summary: {
        totalItems: session.totalItems,
        countedItems: session.countedItems,
        itemsWithDiff: session.itemsWithDiff,
        accuracyPercent: session.accuracyPercent,
        totalDifferenceValue,
      },
      divergences: itemsWithDiff.map((item) => ({
        product: {
          code: item.product.code,
          name: item.product.name,
          type: item.product.type,
        },
        systemQty: item.systemQty,
        countedQty: item.countedQty,
        finalQty: item.finalQty,
        difference: item.difference,
        differencePercent: item.differencePercent,
        status: item.status,
        notes: item.notes,
        reason: item.reason,
      })),
      analysis: {
        shortages: {
          count: shortages.length,
          items: shortages.map((item) => ({
            product: item.product.name,
            difference: item.difference,
          })),
        },
        surpluses: {
          count: surpluses.length,
          items: surpluses.map((item) => ({
            product: item.product.name,
            difference: item.difference,
          })),
        },
      },
    };
  }

  /**
   * Ajustar estoque baseado na sessão
   */
  async adjustStock(id: string, userId: string) {
    const session = await this.findById(id);
    if (!session) {
      throw new Error('Sessão não encontrada');
    }

    if (session.status !== 'COMPLETED') {
      throw new Error('Sessão não está completa');
    }

    const itemsToAdjust = session.items.filter(
      (item) => item.hasDifference && item.status === 'RECOUNTED'
    );

    const adjustments = [];

    for (const item of itemsToAdjust) {
      const difference = Number(item.difference);
      if (difference === 0) continue;

      // Criar movimentação de ajuste
      const movement = await prisma.stockMovement.create({
        data: {
          productId: item.productId,
          type: 'ADJUSTMENT',
          quantity: Math.abs(difference),
          reason: `Ajuste por contagem - Sessão ${session.code}`,
          reference: session.id,
          referenceType: 'COUNTING',
          userId,
          notes: item.reason || undefined,
        },
      });

      // Marcar item como ajustado
      await prisma.countingItem.update({
        where: { id: item.id },
        data: { status: 'ADJUSTED' },
      });

      adjustments.push(movement);
    }

    return {
      adjustmentsCreated: adjustments.length,
      adjustments,
    };
  }

  /**
   * Dashboard de contagens
   */
  async getDashboard() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Planos ativos
    const activePlans = await prisma.countingPlan.count({
      where: { status: 'ACTIVE' },
    });

    // Sessões em andamento
    const activeSessions = await prisma.countingSession.count({
      where: { status: 'IN_PROGRESS' },
    });

    // Itens pendentes
    const pendingItems = await prisma.countingItem.count({
      where: { status: 'PENDING' },
    });

    // Acurácia média (últimos 30 dias)
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const completedSessions = await prisma.countingSession.findMany({
      where: {
        status: 'COMPLETED',
        completedAt: { gte: thirtyDaysAgo },
      },
      select: { accuracyPercent: true },
    });

    const avgAccuracy =
      completedSessions.length > 0
        ? completedSessions.reduce((sum, s) => sum + Number(s.accuracyPercent || 0), 0) /
          completedSessions.length
        : 0;

    // Sessões agendadas para hoje
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const scheduledToday = await prisma.countingSession.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledDate: {
          gte: today,
          lt: tomorrow,
        },
      },
      include: {
        plan: {
          select: {
            name: true,
          },
        },
        assignedUser: {
          select: {
            name: true,
          },
        },
      },
    });

    // Divergências recentes
    const recentDivergences = await prisma.countingItem.findMany({
      where: {
        hasDifference: true,
        countedAt: { gte: thirtyDaysAgo },
      },
      include: {
        product: {
          select: {
            code: true,
            name: true,
          },
        },
      },
      orderBy: {
        countedAt: 'desc',
      },
      take: 10,
    });

    return {
      stats: {
        activePlans,
        activeSessions,
        pendingItems,
        avgAccuracy: avgAccuracy.toFixed(2),
      },
      scheduledToday,
      recentDivergences,
    };
  }
}

export default new CountingSessionService();
