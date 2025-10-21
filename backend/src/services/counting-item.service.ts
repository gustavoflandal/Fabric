import { PrismaClient, CountingItem, CountingItemStatus } from '@prisma/client';

const prisma = new PrismaClient();

export interface CountItemDTO {
  countedQty: number;
  notes?: string;
  countedBy: string;
}

export interface RecountItemDTO {
  recountQty: number;
  notes?: string;
  recountedBy: string;
}

export interface ItemFilters {
  sessionId?: string;
  status?: CountingItemStatus;
  hasDifference?: boolean;
  productId?: string;
}

class CountingItemService {
  /**
   * Listar itens de contagem
   */
  async findAll(filters?: ItemFilters) {
    const where: any = {};

    if (filters?.sessionId) {
      where.sessionId = filters.sessionId;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.hasDifference !== undefined) {
      where.hasDifference = filters.hasDifference;
    }

    if (filters?.productId) {
      where.productId = filters.productId;
    }

    return await prisma.countingItem.findMany({
      where,
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
        session: {
          select: {
            id: true,
            code: true,
            plan: {
              select: {
                name: true,
                tolerancePercent: true,
                toleranceQty: true,
                requireRecount: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  /**
   * Buscar item por ID
   */
  async findById(id: string) {
    return await prisma.countingItem.findUnique({
      where: { id },
      include: {
        product: true,
        location: true,
        counter: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        recounter: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        session: {
          include: {
            plan: true,
          },
        },
      },
    });
  }

  /**
   * Contar item
   */
  async count(id: string, data: CountItemDTO): Promise<CountingItem> {
    const item = await this.findById(id);
    if (!item) {
      throw new Error('Item de contagem não encontrado');
    }

    if (item.status !== 'PENDING') {
      throw new Error('Item já foi contado');
    }

    // Calcular divergência
    const difference = data.countedQty - Number(item.systemQty);
    const differencePercent = Number(item.systemQty) > 0 
      ? (difference / Number(item.systemQty)) * 100 
      : 0;

    // Verificar tolerância
    const plan = item.session.plan;
    const tolerancePercent = Number(plan.tolerancePercent) || 0;
    const toleranceQty = plan.toleranceQty || 0;

    const withinTolerance =
      Math.abs(differencePercent) <= tolerancePercent ||
      Math.abs(difference) <= toleranceQty;

    // Determinar se há divergência significativa
    const hasDifference = !withinTolerance && difference !== 0;

    // Determinar próximo status
    let status: CountingItemStatus = 'COUNTED';
    let finalQty = data.countedQty;

    if (!hasDifference) {
      // Dentro da tolerância - aceitar automaticamente
      status = 'ADJUSTED';
      finalQty = data.countedQty;
    } else if (plan.requireRecount) {
      // Fora da tolerância e recontagem obrigatória
      status = 'COUNTED';
    } else {
      // Fora da tolerância mas recontagem não obrigatória
      status = 'COUNTED';
      finalQty = data.countedQty;
    }

    // Atualizar item
    const updatedItem = await prisma.countingItem.update({
      where: { id },
      data: {
        countedQty: data.countedQty,
        difference,
        differencePercent,
        hasDifference,
        status,
        finalQty: status === 'ADJUSTED' ? finalQty : null,
        notes: data.notes,
        countedBy: data.countedBy,
        countedAt: new Date(),
      },
      include: {
        product: true,
        session: {
          include: {
            plan: true,
          },
        },
      },
    });

    // Atualizar contadores da sessão
    await this.updateSessionCounters(item.sessionId);

    return updatedItem;
  }

  /**
   * Recontar item
   */
  async recount(id: string, data: RecountItemDTO): Promise<CountingItem> {
    const item = await this.findById(id);
    if (!item) {
      throw new Error('Item de contagem não encontrado');
    }

    if (item.status !== 'COUNTED') {
      throw new Error('Item não está aguardando recontagem');
    }

    // Calcular divergência com a recontagem
    const difference = data.recountQty - Number(item.systemQty);
    const differencePercent = Number(item.systemQty) > 0 
      ? (difference / Number(item.systemQty)) * 100 
      : 0;

    // Atualizar item
    const updatedItem = await prisma.countingItem.update({
      where: { id },
      data: {
        recountQty: data.recountQty,
        difference,
        differencePercent,
        finalQty: data.recountQty,
        status: 'RECOUNTED',
        notes: data.notes,
        recountedBy: data.recountedBy,
        recountedAt: new Date(),
      },
      include: {
        product: true,
        session: {
          include: {
            plan: true,
          },
        },
      },
    });

    // Atualizar contadores da sessão
    await this.updateSessionCounters(item.sessionId);

    return updatedItem;
  }

  /**
   * Aceitar contagem (sem recontagem)
   */
  async accept(id: string, reason?: string): Promise<CountingItem> {
    const item = await this.findById(id);
    if (!item) {
      throw new Error('Item de contagem não encontrado');
    }

    if (item.status !== 'COUNTED') {
      throw new Error('Item não pode ser aceito');
    }

    return await prisma.countingItem.update({
      where: { id },
      data: {
        status: 'RECOUNTED',
        finalQty: item.countedQty,
        reason,
      },
    });
  }

  /**
   * Cancelar contagem de item
   */
  async cancel(id: string, reason?: string): Promise<CountingItem> {
    return await prisma.countingItem.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        reason,
      },
    });
  }

  /**
   * Atualizar contadores da sessão
   */
  private async updateSessionCounters(sessionId: string) {
    const items = await prisma.countingItem.findMany({
      where: { sessionId },
    });

    const countedItems = items.filter(
      (item) => item.status !== 'PENDING' && item.status !== 'CANCELLED'
    ).length;

    const itemsWithDiff = items.filter((item) => item.hasDifference).length;

    await prisma.countingSession.update({
      where: { id: sessionId },
      data: {
        countedItems,
        itemsWithDiff,
      },
    });
  }

  /**
   * Buscar itens pendentes de um usuário
   */
  async findPendingByUser(userId: string) {
    return await prisma.countingItem.findMany({
      where: {
        status: 'PENDING',
        session: {
          assignedTo: userId,
          status: 'IN_PROGRESS',
        },
      },
      include: {
        product: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
          },
        },
        location: true,
        session: {
          select: {
            id: true,
            code: true,
            plan: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  /**
   * Buscar itens com divergência de uma sessão
   */
  async findDivergencesBySession(sessionId: string) {
    return await prisma.countingItem.findMany({
      where: {
        sessionId,
        hasDifference: true,
      },
      include: {
        product: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
            standardCost: true,
          },
        },
        location: true,
        counter: {
          select: {
            name: true,
          },
        },
        recounter: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        differencePercent: 'desc',
      },
    });
  }

  /**
   * Estatísticas de um item
   */
  async getItemStats(productId: string) {
    const items = await prisma.countingItem.findMany({
      where: { productId },
      select: {
        systemQty: true,
        countedQty: true,
        difference: true,
        hasDifference: true,
        countedAt: true,
      },
      orderBy: {
        countedAt: 'desc',
      },
      take: 10,
    });

    const totalCounts = items.length;
    const divergences = items.filter((item) => item.hasDifference).length;
    const accuracyRate = totalCounts > 0 ? ((totalCounts - divergences) / totalCounts) * 100 : 100;

    return {
      totalCounts,
      divergences,
      accuracyRate: accuracyRate.toFixed(2),
      history: items,
    };
  }
}

export default new CountingItemService();
