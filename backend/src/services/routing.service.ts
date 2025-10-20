import { prisma } from '../config/database';

export interface CreateRoutingDto {
  productId: string;
  version?: number;
  description?: string;
  validFrom?: string;
  validTo?: string;
  active?: boolean;
  operations: CreateRoutingOperationDto[];
}

export interface CreateRoutingOperationDto {
  sequence: number;
  workCenterId: string;
  description: string;
  setupTime: number;
  runTime: number;
  queueTime?: number;
  moveTime?: number;
  notes?: string;
}

export interface UpdateRoutingDto {
  description?: string;
  validFrom?: string;
  validTo?: string;
  active?: boolean;
  operations?: UpdateRoutingOperationDto[];
}

export interface UpdateRoutingOperationDto {
  id?: string;
  sequence: number;
  workCenterId: string;
  description: string;
  setupTime: number;
  runTime: number;
  queueTime?: number;
  moveTime?: number;
  notes?: string;
}

export class RoutingService {
  async create(data: CreateRoutingDto) {
    // Se não informou versão, buscar a próxima disponível
    if (!data.version) {
      const lastRouting = await prisma.routing.findFirst({
        where: { productId: data.productId },
        orderBy: { version: 'desc' },
      });
      data.version = lastRouting ? lastRouting.version + 1 : 1;
    }

    // Se está criando como ativo, desativar outros roteiros do produto
    if (data.active) {
      await prisma.routing.updateMany({
        where: { productId: data.productId, active: true },
        data: { active: false },
      });
    }

    return prisma.routing.create({
      data: {
        productId: data.productId,
        version: data.version,
        description: data.description,
        validFrom: data.validFrom ? new Date(data.validFrom) : undefined,
        validTo: data.validTo ? new Date(data.validTo) : undefined,
        active: data.active ?? true,
        operations: {
          create: data.operations.map((op) => ({
            sequence: op.sequence,
            workCenterId: op.workCenterId,
            description: op.description,
            setupTime: op.setupTime,
            runTime: op.runTime,
            queueTime: op.queueTime ?? 0,
            moveTime: op.moveTime ?? 0,
            notes: op.notes,
          })),
        },
      },
      include: {
        product: { select: { id: true, code: true, name: true } },
        operations: {
          include: {
            workCenter: { select: { id: true, code: true, name: true } },
          },
          orderBy: { sequence: 'asc' },
        },
      },
    });
  }

  async getAll(page = 1, limit = 100, filters?: { productId?: string; active?: boolean; search?: string }) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filters?.productId) {
      where.productId = filters.productId;
    }

    if (filters?.active !== undefined) {
      where.active = filters.active;
    }

    if (filters?.search) {
      where.OR = [
        { description: { contains: filters.search } },
        { product: { code: { contains: filters.search } } },
        { product: { name: { contains: filters.search } } },
      ];
    }

    const [routings, total] = await Promise.all([
      prisma.routing.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ productId: 'asc' }, { version: 'desc' }],
        include: {
          product: { select: { id: true, code: true, name: true } },
          operations: {
            include: {
              workCenter: { select: { id: true, code: true, name: true } },
            },
            orderBy: { sequence: 'asc' },
          },
        },
      }),
      prisma.routing.count({ where }),
    ]);

    return {
      data: routings,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string) {
    return prisma.routing.findUnique({
      where: { id },
      include: {
        product: { select: { id: true, code: true, name: true } },
        operations: {
          include: {
            workCenter: { select: { id: true, code: true, name: true, costPerHour: true } },
          },
          orderBy: { sequence: 'asc' },
        },
      },
    });
  }

  async getByProduct(productId: string) {
    return prisma.routing.findMany({
      where: { productId },
      orderBy: { version: 'desc' },
      include: {
        product: { select: { id: true, code: true, name: true } },
        operations: {
          include: {
            workCenter: { select: { id: true, code: true, name: true } },
          },
          orderBy: { sequence: 'asc' },
        },
      },
    });
  }

  async update(id: string, data: UpdateRoutingDto) {
    const routing = await prisma.routing.findUnique({ where: { id } });
    if (!routing) {
      throw new Error('Roteiro não encontrado');
    }

    // Se está ativando, desativar outros roteiros do produto
    if (data.active && !routing.active) {
      await prisma.routing.updateMany({
        where: { productId: routing.productId, active: true, id: { not: id } },
        data: { active: false },
      });
    }

    // Se tem operações, deletar as antigas e criar as novas
    if (data.operations) {
      await prisma.routingOperation.deleteMany({
        where: { routingId: id },
      });
    }

    return prisma.routing.update({
      where: { id },
      data: {
        description: data.description,
        validFrom: data.validFrom ? new Date(data.validFrom) : undefined,
        validTo: data.validTo ? new Date(data.validTo) : undefined,
        active: data.active,
        operations: data.operations
          ? {
              create: data.operations.map((op) => ({
                sequence: op.sequence,
                workCenterId: op.workCenterId,
                description: op.description,
                setupTime: op.setupTime,
                runTime: op.runTime,
                queueTime: op.queueTime ?? 0,
                moveTime: op.moveTime ?? 0,
                notes: op.notes,
              })),
            }
          : undefined,
      },
      include: {
        product: { select: { id: true, code: true, name: true } },
        operations: {
          include: {
            workCenter: { select: { id: true, code: true, name: true } },
          },
          orderBy: { sequence: 'asc' },
        },
      },
    });
  }

  async delete(id: string) {
    return prisma.routing.delete({ where: { id } });
  }

  async setActive(id: string, productId: string, active: boolean) {
    if (active) {
      // Desativar outros roteiros do produto
      await prisma.routing.updateMany({
        where: { productId, active: true, id: { not: id } },
        data: { active: false },
      });
    }

    return prisma.routing.update({
      where: { id },
      data: { active },
      include: {
        product: { select: { id: true, code: true, name: true } },
        operations: {
          include: {
            workCenter: { select: { id: true, code: true, name: true } },
          },
          orderBy: { sequence: 'asc' },
        },
      },
    });
  }

  async calculateTotalTime(id: string, quantity: number = 1) {
    const routing = await this.getById(id);
    if (!routing) {
      throw new Error('Roteiro não encontrado');
    }

    let totalSetupTime = 0;
    let totalRunTime = 0;
    let totalQueueTime = 0;
    let totalMoveTime = 0;

    for (const operation of routing.operations) {
      totalSetupTime += operation.setupTime;
      totalRunTime += operation.runTime * quantity;
      totalQueueTime += operation.queueTime;
      totalMoveTime += operation.moveTime;
    }

    const totalTime = totalSetupTime + totalRunTime + totalQueueTime + totalMoveTime;

    return {
      routing: {
        id: routing.id,
        version: routing.version,
        productId: routing.productId,
      },
      quantity,
      times: {
        setupTime: totalSetupTime,
        runTime: totalRunTime,
        queueTime: totalQueueTime,
        moveTime: totalMoveTime,
        totalTime,
      },
      operations: routing.operations.map((op) => ({
        sequence: op.sequence,
        workCenter: op.workCenter,
        description: op.description,
        setupTime: op.setupTime,
        runTime: op.runTime * quantity,
        queueTime: op.queueTime,
        moveTime: op.moveTime,
        totalTime: op.setupTime + op.runTime * quantity + op.queueTime + op.moveTime,
      })),
    };
  }
}

export default new RoutingService();
