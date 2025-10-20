import { prisma } from '../config/database';

export interface CreateProductionOrderDto {
  orderNumber: string;
  productId: string;
  quantity: number;
  scheduledStart: string;
  scheduledEnd: string;
  priority?: number;
  notes?: string;
}

export interface UpdateProductionOrderDto {
  orderNumber?: string;
  quantity?: number;
  scheduledStart?: string;
  scheduledEnd?: string;
  priority?: number;
  notes?: string;
}

export class ProductionOrderService {
  async create(data: CreateProductionOrderDto, userId: string) {
    // Verificar se o produto existe
    const product = await prisma.product.findUnique({
      where: { id: data.productId },
    });

    if (!product) {
      throw new Error('Produto não encontrado');
    }

    // Criar a ordem
    const order = await prisma.productionOrder.create({
      data: {
        orderNumber: data.orderNumber,
        productId: data.productId,
        quantity: data.quantity,
        producedQty: 0,
        scrapQty: 0,
        status: 'PLANNED',
        priority: data.priority || 5,
        scheduledStart: new Date(data.scheduledStart),
        scheduledEnd: new Date(data.scheduledEnd),
        notes: data.notes,
        createdBy: userId,
      },
      include: {
        product: { select: { id: true, code: true, name: true, type: true } },
      },
    });

    // Calcular materiais necessários via BOM
    await this.calculateMaterials(order.id);

    // Calcular operações via Routing
    await this.calculateOperations(order.id);

    return this.getById(order.id);
  }

  async getAll(
    page = 1,
    limit = 100,
    filters?: {
      status?: string;
      productId?: string;
      priority?: string;
      search?: string;
      startDate?: string;
      endDate?: string;
    }
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.productId) {
      where.productId = filters.productId;
    }

    if (filters?.priority) {
      where.priority = filters.priority;
    }

    if (filters?.search) {
      where.OR = [
        { orderNumber: { contains: filters.search } },
        { product: { code: { contains: filters.search } } },
        { product: { name: { contains: filters.search } } },
      ];
    }

    if (filters?.startDate) {
      where.plannedStartDate = {
        gte: new Date(filters.startDate),
      };
    }

    if (filters?.endDate) {
      where.plannedEndDate = {
        lte: new Date(filters.endDate),
      };
    }

    const [orders, total] = await Promise.all([
      prisma.productionOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ scheduledStart: 'desc' }, { createdAt: 'desc' }],
        include: {
          product: { select: { id: true, code: true, name: true, type: true } },
        },
      }),
      prisma.productionOrder.count({ where }),
    ]);

    return {
      data: orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string) {
    return prisma.productionOrder.findUnique({
      where: { id },
      include: {
        product: { select: { id: true, code: true, name: true, type: true } },
        operations: {
          include: {
            workCenter: { select: { id: true, code: true, name: true } },
          },
          orderBy: { sequence: 'asc' },
        },
      },
    });
  }

  async update(id: string, data: UpdateProductionOrderDto) {
    return prisma.productionOrder.update({
      where: { id },
      data: {
        orderNumber: data.orderNumber,
        quantity: data.quantity,
        scheduledStart: data.scheduledStart ? new Date(data.scheduledStart) : undefined,
        scheduledEnd: data.scheduledEnd ? new Date(data.scheduledEnd) : undefined,
        priority: data.priority,
        notes: data.notes,
      },
      include: {
        product: { select: { id: true, code: true, name: true, type: true } },
      },
    });
  }

  async delete(id: string) {
    // Deletar operações associadas
    await prisma.productionOrderOperation.deleteMany({
      where: { productionOrderId: id },
    });

    return prisma.productionOrder.delete({ where: { id } });
  }

  async changeStatus(id: string, status: string, notes?: string) {
    const order = await prisma.productionOrder.findUnique({ where: { id } });
    if (!order) {
      throw new Error('Ordem de produção não encontrada');
    }

    const updateData: any = { status };

    // Atualizar datas reais baseado no status
    if (status === 'IN_PROGRESS' && !order.actualStart) {
      updateData.actualStart = new Date();
    }

    if (status === 'COMPLETED' && !order.actualEnd) {
      updateData.actualEnd = new Date();
    }

    if (notes) {
      updateData.notes = order.notes ? `${order.notes}\n${notes}` : notes;
    }

    return prisma.productionOrder.update({
      where: { id },
      data: updateData,
      include: {
        product: { select: { id: true, code: true, name: true, type: true } },
      },
    });
  }

  async updateProgress(id: string, producedQuantity: number, scrapQuantity: number = 0) {
    const order = await prisma.productionOrder.findUnique({ where: { id } });
    if (!order) {
      throw new Error('Ordem de produção não encontrada');
    }

    const updateData: any = {
      producedQty: producedQuantity,
      scrapQty: scrapQuantity,
    };

    // Se atingiu a quantidade planejada, marcar como concluída
    if (producedQuantity >= order.quantity && order.status !== 'COMPLETED') {
      updateData.status = 'COMPLETED';
      updateData.actualEnd = new Date();
    }

    return prisma.productionOrder.update({
      where: { id },
      data: updateData,
      include: {
        product: { select: { id: true, code: true, name: true, type: true } },
      },
    });
  }

  async calculateMaterials(orderId: string) {
    const order = await prisma.productionOrder.findUnique({
      where: { id: orderId },
      include: { product: true },
    });

    if (!order) {
      throw new Error('Ordem de produção não encontrada');
    }

    // Buscar BOM ativa do produto
    const bom = await prisma.bOM.findFirst({
      where: {
        productId: order.productId,
        active: true,
      },
      include: {
        items: {
          include: {
            component: true,
            unit: true,
          },
        },
      },
    });

    if (!bom) {
      return { message: 'Produto não possui BOM ativa', materials: [] };
    }

    // Calcular necessidades de materiais
    const materials = bom.items.map((item) => ({
      componentId: item.componentId,
      componentCode: item.component.code,
      componentName: item.component.name,
      quantityPerUnit: item.quantity,
      totalQuantity: item.quantity * order.quantity * (1 + item.scrapFactor),
      unitId: item.unitId,
      unitCode: item.unit.code,
      scrapFactor: item.scrapFactor,
    }));

    return {
      bomId: bom.id,
      bomVersion: bom.version,
      materials,
    };
  }

  async calculateOperations(orderId: string) {
    const order = await prisma.productionOrder.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new Error('Ordem de produção não encontrada');
    }

    // Buscar Routing ativo do produto
    const routing = await prisma.routing.findFirst({
      where: {
        productId: order.productId,
        active: true,
      },
      include: {
        operations: {
          include: {
            workCenter: true,
          },
          orderBy: { sequence: 'asc' },
        },
      },
    });

    if (!routing) {
      return { message: 'Produto não possui roteiro ativo', operations: [] };
    }

    // Deletar operações existentes
    await prisma.productionOrderOperation.deleteMany({
      where: { productionOrderId: orderId },
    });

    // Criar operações da ordem baseadas no roteiro
    const operations = await Promise.all(
      routing.operations.map((op) =>
        prisma.productionOrderOperation.create({
          data: {
            productionOrderId: orderId,
            sequence: op.sequence,
            workCenterId: op.workCenterId,
            description: op.description,
            plannedQty: order.quantity,
            setupTime: op.setupTime,
            runTime: op.runTime,
            totalPlannedTime: op.setupTime + (op.runTime * order.quantity),
            status: 'PENDING',
          },
          include: {
            workCenter: { select: { id: true, code: true, name: true } },
          },
        })
      )
    );

    return {
      routingId: routing.id,
      routingVersion: routing.version,
      operations,
    };
  }

  async getOperations(orderId: string) {
    return prisma.productionOrderOperation.findMany({
      where: { productionOrderId: orderId },
      include: {
        workCenter: { select: { id: true, code: true, name: true } },
      },
      orderBy: { sequence: 'asc' },
    });
  }

  async getMaterials(orderId: string) {
    return this.calculateMaterials(orderId);
  }
}

export default new ProductionOrderService();
