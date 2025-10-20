import { prisma } from '../config/database';
import materialConsumptionService from './material-consumption.service';
import { eventBus, SystemEvents } from '../events/event-bus';

export interface CreateProductionPointingDto {
  productionOrderId: string;
  operationId: string;
  startTime: string;
  endTime: string;
  goodQuantity: number;
  scrapQuantity?: number;
  setupTime?: number;
  runTime: number;
  notes?: string;
}

export interface UpdateProductionPointingDto {
  endTime?: string | null;
  goodQuantity?: number;
  scrapQuantity?: number;
  notes?: string;
}

export interface FinishPointingDto {
  endTime: string;
  goodQuantity: number;
  scrapQuantity?: number;
  notes?: string;
}

export class ProductionPointingService {
  async create(data: CreateProductionPointingDto, userId: string) {
    // Verificar se a ordem existe
    const order = await prisma.productionOrder.findUnique({
      where: { id: data.productionOrderId },
    });

    if (!order) {
      throw new Error('Ordem de produção não encontrada');
    }

    // Verificar se a operação existe
    const operation = await prisma.productionOrderOperation.findUnique({
      where: { id: data.operationId },
    });

    if (!operation) {
      throw new Error('Operação não encontrada');
    }

    // VALIDAÇÃO 1: Quantidade não pode exceder OP
    const totalPointed = await this.getTotalPointed(data.productionOrderId);
    if (totalPointed + data.goodQuantity > order.quantity) {
      throw new Error(
        `Quantidade apontada (${totalPointed + data.goodQuantity}) excede quantidade da OP (${order.quantity})`
      );
    }

    // VALIDAÇÃO 2: Verificar refugo alto
    const scrapRate = data.scrapQuantity ? (data.scrapQuantity / data.goodQuantity) * 100 : 0;
    const hasHighScrap = scrapRate > 10;

    // Calcular tempo decorrido se endTime foi fornecido
    let elapsedTime = 0;
    if (data.endTime) {
      const start = new Date(data.startTime);
      const end = new Date(data.endTime);
      elapsedTime = (end.getTime() - start.getTime()) / 1000 / 60; // em minutos
    }

    // Criar apontamento
    const pointing = await prisma.productionPointing.create({
      data: {
        productionOrderId: data.productionOrderId,
        operationId: data.operationId,
        userId,
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
        quantityGood: data.goodQuantity || 0,
        quantityScrap: data.scrapQuantity || 0,
        setupTime: data.setupTime || 0,
        runTime: data.runTime,
        notes: data.notes,
      },
      include: {
        productionOrder: {
          select: {
            id: true,
            orderNumber: true,
            product: { select: { code: true, name: true } },
          },
        },
        operation: {
          select: {
            id: true,
            sequence: true,
            description: true,
          },
        },
        workCenter: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // ✅ INTEGRAÇÃO: Consumir materiais automaticamente
    try {
      await materialConsumptionService.consumeMaterials(pointing.id, userId);
      console.log(`[ProductionPointing] Materiais consumidos para apontamento ${pointing.id}`);
    } catch (error: any) {
      console.error(`[ProductionPointing] Erro ao consumir materiais:`, error.message);
      // Não quebra o processo, mas registra o erro
      await eventBus.emit(SystemEvents.SYSTEM_WARNING, {
        type: 'MATERIAL_CONSUMPTION_FAILED',
        pointingId: pointing.id,
        error: error.message,
      });
    }

    // ✅ INTEGRAÇÃO: Atualizar status da operação
    await this.updateOperationStatus(data.operationId);

    // ✅ INTEGRAÇÃO: Verificar conclusão da OP
    await this.checkOrderCompletion(data.productionOrderId);

    // ✅ EVENT: Emitir evento de apontamento criado
    await eventBus.emit(SystemEvents.PRODUCTION_POINTING_CREATED, {
      pointingId: pointing.id,
      productionOrderId: data.productionOrderId,
      operationId: data.operationId,
      goodQuantity: data.goodQuantity,
      scrapQuantity: data.scrapQuantity || 0,
    });

    // ✅ EVENT: Alerta de refugo alto
    if (hasHighScrap) {
      await eventBus.emit(SystemEvents.QUALITY_SCRAP_HIGH, {
        pointingId: pointing.id,
        productionOrderId: data.productionOrderId,
        scrapRate,
        threshold: 10,
      });
    }

    // Se o apontamento foi finalizado, emitir evento
    if (data.endTime) {
      await eventBus.emit(SystemEvents.PRODUCTION_POINTING_FINISHED, {
        pointingId: pointing.id,
        productionOrderId: data.productionOrderId,
        operationId: data.operationId,
      });
    }

    return pointing;
  }

  async getAll(
    page = 1,
    limit = 100,
    filters?: {
      productionOrderId?: string;
      operationId?: string;
      workCenterId?: string;
      userId?: string;
      startDate?: string;
      endDate?: string;
      status?: 'IN_PROGRESS' | 'COMPLETED';
    }
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filters?.productionOrderId) {
      where.productionOrderId = filters.productionOrderId;
    }

    if (filters?.operationId) {
      where.operationId = filters.operationId;
    }

    if (filters?.workCenterId) {
      where.workCenterId = filters.workCenterId;
    }

    if (filters?.userId) {
      where.userId = filters.userId;
    }

    if (filters?.startDate) {
      where.startTime = {
        gte: new Date(filters.startDate),
      };
    }

    if (filters?.endDate) {
      where.startTime = {
        ...where.startTime,
        lte: new Date(filters.endDate),
      };
    }

    if (filters?.status === 'IN_PROGRESS') {
      where.endTime = null;
    } else if (filters?.status === 'COMPLETED') {
      where.endTime = { not: null };
    }

    const [pointings, total] = await Promise.all([
      prisma.productionPointing.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startTime: 'desc' },
        include: {
          productionOrder: {
            select: {
              id: true,
              orderNumber: true,
              product: { select: { code: true, name: true } },
            },
          },
          operation: {
            select: {
              id: true,
              sequence: true,
              description: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prisma.productionPointing.count({ where }),
    ]);

    return {
      data: pointings,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string) {
    return prisma.productionPointing.findUnique({
      where: { id },
      include: {
        productionOrder: {
          select: {
            id: true,
            orderNumber: true,
            product: { select: { code: true, name: true } },
          },
        },
        operation: {
          select: {
            id: true,
            sequence: true,
            description: true,
          },
        },
        workCenter: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  async update(id: string, data: UpdateProductionPointingDto) {
    const pointing = await prisma.productionPointing.findUnique({
      where: { id },
    });

    if (!pointing) {
      throw new Error('Apontamento não encontrado');
    }

    // Calcular tempo decorrido se endTime foi fornecido
    let elapsedTime = pointing.elapsedTime;
    if (data.endTime) {
      const start = pointing.startTime;
      const end = new Date(data.endTime);
      elapsedTime = (end.getTime() - start.getTime()) / 1000 / 60; // em minutos
    }

    const updated = await prisma.productionPointing.update({
      where: { id },
      data: {
        endTime: data.endTime ? new Date(data.endTime) : undefined,
        goodQty: data.goodQuantity,
        scrapQty: data.scrapQuantity,
        elapsedTime,
        notes: data.notes,
      },
      include: {
        productionOrder: {
          select: {
            id: true,
            orderNumber: true,
            product: { select: { code: true, name: true } },
          },
        },
        operation: {
          select: {
            id: true,
            sequence: true,
            description: true,
          },
        },
        workCenter: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Se o apontamento foi finalizado, atualizar a operação
    if (data.endTime && !pointing.endTime) {
      await this.updateOperationProgress(pointing.operationId);
    }

    return updated;
  }

  async finish(id: string, data: FinishPointingDto) {
    const pointing = await prisma.productionPointing.findUnique({
      where: { id },
    });

    if (!pointing) {
      throw new Error('Apontamento não encontrado');
    }

    if (pointing.endTime) {
      throw new Error('Apontamento já foi finalizado');
    }

    // Calcular tempo decorrido
    const start = pointing.startTime;
    const end = new Date(data.endTime);
    const elapsedTime = (end.getTime() - start.getTime()) / 1000 / 60; // em minutos

    const updated = await prisma.productionPointing.update({
      where: { id },
      data: {
        endTime: new Date(data.endTime),
        goodQty: data.goodQuantity,
        scrapQty: data.scrapQuantity || 0,
        elapsedTime,
        notes: data.notes,
      },
      include: {
        productionOrder: {
          select: {
            id: true,
            orderNumber: true,
            product: { select: { code: true, name: true } },
          },
        },
        operation: {
          select: {
            id: true,
            sequence: true,
            description: true,
          },
        },
        workCenter: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Atualizar progresso da operação
    await this.updateOperationProgress(pointing.operationId);

    return updated;
  }

  async delete(id: string) {
    const pointing = await prisma.productionPointing.findUnique({
      where: { id },
    });

    if (!pointing) {
      throw new Error('Apontamento não encontrado');
    }

    await prisma.productionPointing.delete({ where: { id } });

    // Atualizar progresso da operação
    await this.updateOperationProgress(pointing.operationId);
  }

  async getByOrder(orderId: string) {
    return prisma.productionPointing.findMany({
      where: { productionOrderId: orderId },
      orderBy: { startTime: 'desc' },
      include: {
        operation: {
          select: {
            id: true,
            sequence: true,
            description: true,
          },
        },
        workCenter: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async getByOperator(userId: string, startDate?: string, endDate?: string) {
    const where: any = { userId };

    if (startDate) {
      where.startTime = { gte: new Date(startDate) };
    }

    if (endDate) {
      where.startTime = {
        ...where.startTime,
        lte: new Date(endDate),
      };
    }

    return prisma.productionPointing.findMany({
      where,
      orderBy: { startTime: 'desc' },
      include: {
        productionOrder: {
          select: {
            id: true,
            orderNumber: true,
            product: { select: { code: true, name: true } },
          },
        },
        operation: {
          select: {
            id: true,
            sequence: true,
            description: true,
          },
        },
        workCenter: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });
  }

  private async updateOperationProgress(operationId: string) {
    // Somar todas as quantidades apontadas para a operação
    const pointings = await prisma.productionPointing.findMany({
      where: { operationId },
    });

    const completedQty = pointings.reduce((sum, p) => sum + p.goodQty, 0);
    const scrapQty = pointings.reduce((sum, p) => sum + p.scrapQty, 0);
    const actualTime = pointings.reduce((sum, p) => sum + p.elapsedTime, 0);

    // Atualizar operação
    const operation = await prisma.productionOrderOperation.update({
      where: { id: operationId },
      data: {
        completedQty,
        scrapQty,
        actualTime,
      },
    });

    // Se a operação foi concluída, verificar se deve mudar o status
    if (completedQty >= operation.plannedQty && operation.status !== 'COMPLETED') {
      await prisma.productionOrderOperation.update({
        where: { id: operationId },
        data: { status: 'COMPLETED' },
      });
    } else if (completedQty > 0 && operation.status === 'PENDING') {
      await prisma.productionOrderOperation.update({
        where: { id: operationId },
        data: { status: 'IN_PROGRESS' },
      });
    }

    // Atualizar progresso da ordem de produção
    await this.updateOrderProgress(operation.productionOrderId);
  }

  private async updateOrderProgress(orderId: string) {
    // Somar todas as quantidades das operações
    const operations = await prisma.productionOrderOperation.findMany({
      where: { productionOrderId: orderId },
    });

    // A quantidade produzida da ordem é a menor quantidade completada entre todas as operações
    const producedQty = Math.min(...operations.map(op => op.completedQty));
    const scrapQty = operations.reduce((sum, op) => sum + op.scrapQty, 0);

    await prisma.productionOrder.update({
      where: { id: orderId },
      data: {
        producedQty,
        scrapQty,
      },
    });
  }

  /**
   * Calcula total já apontado para uma OP
   */
  private async getTotalPointed(productionOrderId: string): Promise<number> {
    const pointings = await prisma.productionPointing.findMany({
      where: { productionOrderId },
    });

    return pointings.reduce((sum, p) => sum + p.quantityGood, 0);
  }

  /**
   * Atualiza status da operação baseado nos apontamentos
   */
  private async updateOperationStatus(operationId: string): Promise<void> {
    const operation = await prisma.productionOrderOperation.findUnique({
      where: { id: operationId },
      include: { productionOrder: true },
    });

    if (!operation) return;

    const totalPointed = await prisma.productionPointing.aggregate({
      where: { operationId },
      _sum: { quantityGood: true },
    });

    const pointed = totalPointed._sum.quantityGood || 0;
    const required = operation.productionOrder.quantity;

    let status = 'PENDING';
    if (pointed >= required) {
      status = 'COMPLETED';
    } else if (pointed > 0) {
      status = 'IN_PROGRESS';
    }

    await prisma.productionOrderOperation.update({
      where: { id: operationId },
      data: {
        status,
        actualQuantity: pointed,
      },
    });

    // Emitir evento se operação foi concluída
    if (status === 'COMPLETED') {
      await eventBus.emit(SystemEvents.PRODUCTION_OPERATION_COMPLETED, {
        operationId: operation.id,
        productionOrderId: operation.productionOrderId,
        actualQuantity: pointed,
      });
    } else if (status === 'IN_PROGRESS') {
      await eventBus.emit(SystemEvents.PRODUCTION_OPERATION_STARTED, {
        operationId: operation.id,
        productionOrderId: operation.productionOrderId,
      });
    }
  }

  /**
   * Verifica se a OP foi concluída
   */
  private async checkOrderCompletion(productionOrderId: string): Promise<void> {
    const operations = await prisma.productionOrderOperation.findMany({
      where: { productionOrderId },
    });

    const allCompleted = operations.every(op => op.status === 'COMPLETED');

    if (allCompleted) {
      await prisma.productionOrder.update({
        where: { id: productionOrderId },
        data: {
          status: 'COMPLETED',
          actualEnd: new Date(),
        },
      });

      // Emitir evento de OP concluída
      await eventBus.emit(SystemEvents.PRODUCTION_ORDER_COMPLETED, {
        productionOrderId,
      });

      console.log(`[ProductionPointing] OP ${productionOrderId} concluída!`);
    }
  }
}

export default new ProductionPointingService();
