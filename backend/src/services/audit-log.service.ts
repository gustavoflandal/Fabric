import { prisma } from '../config/database';
import { Request } from 'express';

export interface CreateAuditLogDto {
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  description?: string;
  ipAddress?: string;
  userAgent?: string;
  method?: string;
  endpoint?: string;
  statusCode?: number;
  requestBody?: any;
  responseBody?: any;
  oldValues?: any;
  newValues?: any;
  errorMessage?: string;
  durationMs?: number;
}

export class AuditLogService {
  async create(data: CreateAuditLogDto) {
    return await prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: data.action,
        resource: data.resource,
        resourceId: data.resourceId,
        description: data.description,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        method: data.method,
        endpoint: data.endpoint,
        statusCode: data.statusCode,
        requestBody: data.requestBody,
        responseBody: data.responseBody,
        oldValues: data.oldValues,
        newValues: data.newValues,
        errorMessage: data.errorMessage,
        durationMs: data.durationMs,
      },
    });
  }

  async getAll(page = 1, limit = 100, filters?: {
    userId?: string;
    resource?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters?.userId) {
      where.userId = filters.userId;
    }

    if (filters?.resource) {
      where.resource = filters.resource;
    }

    if (filters?.action) {
      where.action = filters.action;
    }

    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.createdAt.lte = filters.endDate;
      }
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      data: logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string) {
    return await prisma.auditLog.findUnique({
      where: { id },
      include: {
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

  async getByResource(resource: string, resourceId: string) {
    return await prisma.auditLog.findMany({
      where: {
        resource,
        resourceId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getStatistics(startDate?: Date, endDate?: Date) {
    const where: any = {};

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = startDate;
      }
      if (endDate) {
        where.createdAt.lte = endDate;
      }
    }

    const [
      totalLogs,
      byAction,
      byResource,
      byUser,
    ] = await Promise.all([
      prisma.auditLog.count({ where }),
      
      prisma.auditLog.groupBy({
        by: ['action'],
        where,
        _count: true,
        orderBy: { _count: { action: 'desc' } },
      }),
      
      prisma.auditLog.groupBy({
        by: ['resource'],
        where,
        _count: true,
        orderBy: { _count: { resource: 'desc' } },
      }),
      
      prisma.auditLog.groupBy({
        by: ['userId'],
        where: { ...where, userId: { not: null } },
        _count: true,
        orderBy: { _count: { userId: 'desc' } },
        take: 10,
      }),
    ]);

    return {
      totalLogs,
      byAction: byAction.map((item) => ({
        action: item.action,
        count: item._count,
      })),
      byResource: byResource.map((item) => ({
        resource: item.resource,
        count: item._count,
      })),
      topUsers: byUser.map((item) => ({
        userId: item.userId,
        count: item._count,
      })),
    };
  }

  // Helper para extrair IP do request
  getIpAddress(req: Request): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      (req.headers['x-real-ip'] as string) ||
      req.socket.remoteAddress ||
      'unknown'
    );
  }

  // Helper para criar log de uma requisição
  async logRequest(
    req: Request,
    userId: string | undefined,
    action: string,
    resource: string,
    resourceId?: string,
    description?: string,
    oldValues?: any,
    newValues?: any
  ) {
    return await this.create({
      userId,
      action,
      resource,
      resourceId,
      description,
      ipAddress: this.getIpAddress(req),
      userAgent: req.headers['user-agent'],
      method: req.method,
      endpoint: req.originalUrl,
    });
  }

  // Excluir logs por período
  async deleteLogs(startDate: Date, endDate: Date) {
    const result = await prisma.auditLog.deleteMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    return {
      count: result.count,
      startDate,
      endDate,
    };
  }
}

export default new AuditLogService();
