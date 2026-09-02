import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import materialConsumptionService from './material-consumption.service';
import { eventBus, SystemEvents } from '../events/event-bus';
import notificationDetector from './notification-detector.service';
import { AppError } from '../middleware/error.middleware';

type TransactionClient = Prisma.TransactionClient;

export interface CreateProductionPointingDto {
  productionOrderId: string;
  operationId: string;
  workCenterId: string;
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
    // ✅ CORREÇÃO RACE CONDITION (Fase 1, item 1.5): criação do apontamento +
    // validação de quantidade + status da operação/OP agora são atômicos.
    // Antes, a validação "não pode exceder a OP" lia getTotalPointed() fora de
    // transação - dois apontamentos concorrentes na mesma OP podiam ambos
    // passar na validação e só depois de escritos, juntos, ultrapassar a
    // quantidade da OP. O consumo de materiais continua fora da transação de
    // propósito: é best-effort por design (ver comentário abaixo), travar a
    // criação do apontamento a ele mudaria esse comportamento deliberado.
    const { pointing, statusEvent, orderCompletedId } = await prisma.$transaction(async (tx) => {
      const order = await tx.productionOrder.findUnique({
        where: { id: data.productionOrderId },
      });

      if (!order) {
        throw new AppError(404, 'Ordem de produção não encontrada');
      }

      const operation = await tx.productionOrderOperation.findUnique({
        where: { id: data.operationId },
      });

      if (!operation) {
        throw new AppError(404, 'Operação não encontrada');
      }

      // VALIDAÇÃO 1: Quantidade não pode exceder OP
      const totalPointed = await this.getTotalPointed(data.productionOrderId, tx);
      if (totalPointed + data.goodQuantity > order.quantity) {
        throw new AppError(
          400,
          `Quantidade apontada (${totalPointed + data.goodQuantity}) excede quantidade da OP (${order.quantity})`
        );
      }

      const pointing = await tx.productionPointing.create({
        data: {
          productionOrderId: data.productionOrderId,
          operationId: data.operationId,
          workCenterId: data.workCenterId,
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

      const statusEvent = await this.updateOperationStatus(data.operationId, tx);
      const orderCompletedId = await this.checkOrderCompletion(data.productionOrderId, tx);

      return { pointing, statusEvent, orderCompletedId };
    });

    // VALIDAÇÃO 2: Verificar refugo alto (não depende de estado concorrente)
    const scrapRate = data.scrapQuantity ? (data.scrapQuantity / data.goodQuantity) * 100 : 0;
    const hasHighScrap = scrapRate > 10;

    // ✅ INTEGRAÇÃO: Consumir materiais automaticamente (best-effort,
    // deliberadamente fora da transação acima - ver comentário no início do método)
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

    // ✅ NOTIFICAÇÃO: Monitorar taxa de refugo
    if (data.scrapQuantity && data.scrapQuantity > 0) {
      notificationDetector.monitorScrapRate(pointing.id).catch(err => {
        console.error('Erro ao monitorar refugo:', err);
      });
    }

    // ✅ NOTIFICAÇÃO: Operação concluída
    if (data.endTime) {
      notificationDetector.notifyOperationCompleted(pointing.id).catch(err => {
        console.error('Erro ao notificar conclusão:', err);
      });
    }

    // Eventos de status da operação/OP, emitidos após o commit da transação
    if (statusEvent?.event === 'COMPLETED') {
      await eventBus.emit(SystemEvents.PRODUCTION_OPERATION_COMPLETED, {
        operationId: statusEvent.operationId,
        productionOrderId: statusEvent.productionOrderId,
        actualQuantity: statusEvent.actualQuantity,
      });
    } else if (statusEvent?.event === 'STARTED') {
      await eventBus.emit(SystemEvents.PRODUCTION_OPERATION_STARTED, {
        operationId: statusEvent.operationId,
        productionOrderId: statusEvent.productionOrderId,
      });
    }

    if (orderCompletedId) {
      await eventBus.emit(SystemEvents.PRODUCTION_ORDER_COMPLETED, {
        productionOrderId: orderCompletedId,
      });
      console.log(`[ProductionPointing] OP ${orderCompletedId} concluída!`);
    }

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
    // ✅ CORREÇÃO RACE CONDITION (Fase 1, item 1.5): atualização do apontamento
    // + recálculo de progresso da operação/OP na mesma transação.
    return await prisma.$transaction(async (tx) => {
      const pointing = await tx.productionPointing.findUnique({
        where: { id },
      });

      if (!pointing) {
        throw new AppError(404, 'Apontamento não encontrado');
      }

      // Calcular tempo decorrido se endTime foi fornecido. ProductionPointing
      // não tem um campo "elapsedTime" separado (drift antigo tentava gravar
      // um que nunca existiu) - runTime já representa o tempo do apontamento,
      // então recalculamos e gravamos nele.
      let runTime = pointing.runTime;
      if (data.endTime) {
        const start = pointing.startTime;
        const end = new Date(data.endTime);
        runTime = (end.getTime() - start.getTime()) / 1000 / 60; // em minutos
      }

      const updated = await tx.productionPointing.update({
        where: { id },
        data: {
          endTime: data.endTime ? new Date(data.endTime) : undefined,
          quantityGood: data.goodQuantity,
          quantityScrap: data.scrapQuantity,
          runTime,
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
        await this.updateOperationProgress(pointing.operationId, tx);
      }

      return updated;
    });
  }

  async finish(id: string, data: FinishPointingDto) {
    // ✅ CORREÇÃO RACE CONDITION (Fase 1, item 1.5): finalização do apontamento
    // + recálculo de progresso na mesma transação.
    return await prisma.$transaction(async (tx) => {
      const pointing = await tx.productionPointing.findUnique({
        where: { id },
      });

      if (!pointing) {
        throw new AppError(404, 'Apontamento não encontrado');
      }

      if (pointing.endTime) {
        throw new AppError(409, 'Apontamento já foi finalizado');
      }

      // Calcular tempo decorrido e gravar em runTime (ver comentário em update())
      const start = pointing.startTime;
      const end = new Date(data.endTime);
      const runTime = (end.getTime() - start.getTime()) / 1000 / 60; // em minutos

      const updated = await tx.productionPointing.update({
        where: { id },
        data: {
          endTime: new Date(data.endTime),
          quantityGood: data.goodQuantity,
          quantityScrap: data.scrapQuantity || 0,
          runTime,
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
      await this.updateOperationProgress(pointing.operationId, tx);

      return updated;
    });
  }

  async delete(id: string) {
    // ✅ CORREÇÃO RACE CONDITION (Fase 1, item 1.5): exclusão do apontamento
    // + recálculo de progresso na mesma transação.
    await prisma.$transaction(async (tx) => {
      const pointing = await tx.productionPointing.findUnique({
        where: { id },
      });

      if (!pointing) {
        throw new AppError(404, 'Apontamento não encontrado');
      }

      await tx.productionPointing.delete({ where: { id } });

      // Atualizar progresso da operação
      await this.updateOperationProgress(pointing.operationId, tx);
    });
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

  // ✅ CORREÇÃO RACE CONDITION (Fase 1, item 1.5 do cronograma): as quatro
  // funções abaixo (updateOperationProgress/updateOrderProgress usadas por
  // update/finish/delete, updateOperationStatus/checkOrderCompletion usadas
  // por create) agora recebem opcionalmente o `tx` da transação do chamador,
  // em vez de escrever direto com o client `prisma` singleton fora de
  // qualquer transação. Isso serializa leitura+escrita do progresso da
  // operação/OP por linha travada (o UPDATE do Prisma já bloqueia a linha até
  // o commit), evitando que dois apontamentos concorrentes na mesma operação
  // leiam o mesmo progresso desatualizado. Chamadas fora de uma transação
  // (nenhuma neste arquivo, mas a assinatura permite) continuam funcionando
  // com o client padrão.
  //
  // As duas que emitem evento (updateOperationStatus, checkOrderCompletion)
  // retornam os dados do evento em vez de emitir na hora: emitir dentro da
  // transação arriscaria um listener ler estado ainda não commitado (ou
  // travar esperando a mesma linha). Quem chama emite depois do commit.

  private async updateOperationProgress(operationId: string, tx: TransactionClient = prisma) {
    // Somar todas as quantidades apontadas para a operação
    const pointings = await tx.productionPointing.findMany({
      where: { operationId },
    });

    const completedQty = pointings.reduce((sum, p) => sum + p.quantityGood, 0);
    const scrapQty = pointings.reduce((sum, p) => sum + p.quantityScrap, 0);
    const actualTime = pointings.reduce((sum, p) => sum + p.runTime, 0);

    // Atualizar operação
    const operation = await tx.productionOrderOperation.update({
      where: { id: operationId },
      data: {
        completedQty,
        scrapQty,
        actualTime,
      },
    });

    // Se a operação foi concluída, verificar se deve mudar o status
    if (completedQty >= operation.plannedQty && operation.status !== 'COMPLETED') {
      await tx.productionOrderOperation.update({
        where: { id: operationId },
        data: { status: 'COMPLETED' },
      });
    } else if (completedQty > 0 && operation.status === 'PENDING') {
      await tx.productionOrderOperation.update({
        where: { id: operationId },
        data: { status: 'IN_PROGRESS' },
      });
    }

    // Atualizar progresso da ordem de produção
    await this.updateOrderProgress(operation.productionOrderId, tx);
  }

  private async updateOrderProgress(orderId: string, tx: TransactionClient = prisma) {
    // Somar todas as quantidades das operações
    const operations = await tx.productionOrderOperation.findMany({
      where: { productionOrderId: orderId },
    });

    // A quantidade produzida da ordem é a menor quantidade completada entre todas as operações
    const producedQty = Math.min(...operations.map(op => op.completedQty));
    const scrapQty = operations.reduce((sum, op) => sum + op.scrapQty, 0);

    await tx.productionOrder.update({
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
  private async getTotalPointed(productionOrderId: string, tx: TransactionClient = prisma): Promise<number> {
    const pointings = await tx.productionPointing.findMany({
      where: { productionOrderId },
    });

    return pointings.reduce((sum, p) => sum + p.quantityGood, 0);
  }

  /**
   * Atualiza status da operação baseado nos apontamentos.
   * Retorna os dados do evento a emitir (ou null), para o chamador emitir
   * depois do commit da transação.
   */
  private async updateOperationStatus(
    operationId: string,
    tx: TransactionClient = prisma
  ): Promise<{ event: 'COMPLETED' | 'STARTED'; operationId: string; productionOrderId: string; actualQuantity: number } | null> {
    const operation = await tx.productionOrderOperation.findUnique({
      where: { id: operationId },
      include: { productionOrder: true },
    });

    if (!operation) return null;

    const totalPointed = await tx.productionPointing.aggregate({
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

    // ✅ Fase 1 item 1.5: escrevia em `actualQuantity`, campo que nunca
    // existiu em ProductionOrderOperation (o campo real, ja usado
    // corretamente por updateOperationProgress/updateOrderProgress abaixo,
    // e completedQty) - toda chamada falhava no Prisma.
    await tx.productionOrderOperation.update({
      where: { id: operationId },
      data: {
        status,
        completedQty: pointed,
      },
    });

    if (status === 'COMPLETED') {
      return { event: 'COMPLETED', operationId: operation.id, productionOrderId: operation.productionOrderId, actualQuantity: pointed };
    } else if (status === 'IN_PROGRESS') {
      return { event: 'STARTED', operationId: operation.id, productionOrderId: operation.productionOrderId, actualQuantity: pointed };
    }
    return null;
  }

  /**
   * Verifica se a OP foi concluída. Retorna o productionOrderId se a OP
   * acabou de ser concluída (para o chamador emitir o evento depois do
   * commit), ou null.
   */
  private async checkOrderCompletion(productionOrderId: string, tx: TransactionClient = prisma): Promise<string | null> {
    const operations = await tx.productionOrderOperation.findMany({
      where: { productionOrderId },
    });

    const allCompleted = operations.every(op => op.status === 'COMPLETED');

    if (allCompleted) {
      await tx.productionOrder.update({
        where: { id: productionOrderId },
        data: {
          status: 'COMPLETED',
          actualEnd: new Date(),
        },
      });

      return productionOrderId;
    }
    return null;
  }
}

export default new ProductionPointingService();
