import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';

export interface CreateNotificationDto {
  userId: string;
  type: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';
  category: 'PRODUCTION' | 'STOCK' | 'PURCHASE' | 'QUALITY' | 'CAPACITY';
  eventType: string;
  title: string;
  message: string;
  data?: any;
  link?: string;
  resourceType?: string;
  resourceId?: string;
  priority?: number;
  expiresAt?: Date;
}

export interface NotificationFilters {
  category?: string;
  priority?: number;
  read?: boolean;
  archived?: boolean;
  startDate?: Date;
  endDate?: Date;
}

export class NotificationService {
  /**
   * Criar uma nova notificação
   */
  async create(data: CreateNotificationDto) {
    const notification = await prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        category: data.category,
        eventType: data.eventType,
        title: data.title,
        message: data.message,
        data: data.data || {},
        link: data.link,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        priority: data.priority || 1,
        expiresAt: data.expiresAt,
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
    });

    return notification;
  }

  /**
   * Criar notificações em massa para múltiplos usuários
   */
  async createBulk(userIds: string[], notificationData: Omit<CreateNotificationDto, 'userId'>) {
    const notifications = await prisma.notification.createMany({
      data: userIds.map(userId => ({
        userId,
        type: notificationData.type,
        category: notificationData.category,
        eventType: notificationData.eventType,
        title: notificationData.title,
        message: notificationData.message,
        data: notificationData.data || {},
        link: notificationData.link,
        resourceType: notificationData.resourceType,
        resourceId: notificationData.resourceId,
        priority: notificationData.priority || 1,
        expiresAt: notificationData.expiresAt,
      })),
    });

    return notifications;
  }

  /**
   * Buscar notificações de um usuário
   */
  async getByUser(
    userId: string,
    filters?: NotificationFilters,
    page = 1,
    limit = 20
  ) {
    const where: any = {
      userId,
      archived: filters?.archived ?? false,
    };

    if (filters?.category) {
      where.category = filters.category;
    }

    if (filters?.priority) {
      where.priority = { gte: filters.priority };
    }

    if (filters?.read !== undefined) {
      where.read = filters.read;
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

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({ where }),
    ]);

    return {
      data: notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Buscar notificações críticas não lidas
   */
  async getCriticalUnread(userId: string) {
    return prisma.notification.findMany({
      where: {
        userId,
        read: false,
        archived: false,
        priority: { gte: 3 }, // Alta ou Crítica
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
      take: 10,
    });
  }

  /**
   * Contar notificações não lidas
   */
  async countUnread(userId: string): Promise<number> {
    return prisma.notification.count({
      where: {
        userId,
        read: false,
        archived: false,
      },
    });
  }

  /**
   * Contar por prioridade
   */
  async countByPriority(userId: string) {
    const counts = await prisma.notification.groupBy({
      by: ['priority'],
      where: {
        userId,
        read: false,
        archived: false,
      },
      _count: true,
    });

    return {
      critical: counts.find(c => c.priority === 4)?._count || 0,
      high: counts.find(c => c.priority === 3)?._count || 0,
      medium: counts.find(c => c.priority === 2)?._count || 0,
      low: counts.find(c => c.priority === 1)?._count || 0,
    };
  }

  /**
   * Marcar notificação como lida
   */
  async markAsRead(id: string, userId: string) {
    const notification = await prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      throw new AppError(404, 'Notificação não encontrada');
    }

    return prisma.notification.update({
      where: { id },
      data: {
        read: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Marcar todas como lidas
   */
  async markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: {
        userId,
        read: false,
      },
      data: {
        read: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Arquivar notificação
   */
  async archive(id: string, userId: string) {
    const notification = await prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      throw new AppError(404, 'Notificação não encontrada');
    }

    return prisma.notification.update({
      where: { id },
      data: {
        archived: true,
        archivedAt: new Date(),
      },
    });
  }

  /**
   * Verificar se já existe notificação recente do mesmo tipo
   */
  async checkRecentNotification(
    eventType: string,
    resourceId: string,
    hoursAgo: number
  ): Promise<boolean> {
    const since = new Date();
    since.setHours(since.getHours() - hoursAgo);

    const count = await prisma.notification.count({
      where: {
        eventType,
        resourceId,
        createdAt: { gte: since },
      },
    });

    return count > 0;
  }

  /**
   * Limpar notificações expiradas ou antigas
   */
  async cleanupExpired(daysOld = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.setDate() - daysOld);

    // Deletar notificações lidas e arquivadas antigas
    const deleted = await prisma.notification.deleteMany({
      where: {
        OR: [
          {
            expiresAt: { lte: new Date() },
          },
          {
            archived: true,
            archivedAt: { lte: cutoffDate },
          },
          {
            read: true,
            readAt: { lte: cutoffDate },
          },
        ],
      },
    });

    return deleted.count;
  }

  /**
   * Obter métricas de notificações
   */
  async getMetrics(userId: string, days = 7) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Total não lidas
    const totalUnread = await this.countUnread(userId);

    // Por prioridade
    const byPriority = await this.countByPriority(userId);

    // Por categoria
    const byCategory = await prisma.notification.groupBy({
      by: ['category'],
      where: {
        userId,
        read: false,
        archived: false,
      },
      _count: true,
    });

    // Tendência diária
    const dailyTrend = await prisma.$queryRaw<Array<{ date: string; count: number; critical: number }>>`
      SELECT 
        DATE(createdAt) as date,
        COUNT(*) as count,
        SUM(CASE WHEN priority >= 3 THEN 1 ELSE 0 END) as critical
      FROM notifications
      WHERE userId = ${userId}
        AND createdAt >= ${since}
      GROUP BY DATE(createdAt)
      ORDER BY date ASC
    `;

    // Top eventos
    const topEvents = await prisma.notification.groupBy({
      by: ['eventType'],
      where: {
        userId,
        createdAt: { gte: since },
      },
      _count: true,
      orderBy: {
        _count: {
          eventType: 'desc',
        },
      },
      take: 5,
    });

    return {
      totalUnread,
      criticalCount: byPriority.critical,
      highCount: byPriority.high,
      byCategory: byCategory.reduce((acc, item) => {
        acc[item.category] = item._count;
        return acc;
      }, {} as Record<string, number>),
      dailyTrend,
      topEvents: topEvents.map(e => ({
        eventType: e.eventType,
        count: e._count,
      })),
    };
  }
}

export default new NotificationService();
