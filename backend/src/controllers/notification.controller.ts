import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import notificationService from '../services/notification.service';

export class NotificationController {
  /**
   * Listar notificações do usuário
   */
  async getAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const filters: any = {};

      if (req.query.category) {
        filters.category = req.query.category;
      }

      if (req.query.priority) {
        filters.priority = parseInt(req.query.priority as string);
      }

      if (req.query.read !== undefined) {
        filters.read = req.query.read === 'true';
      }

      if (req.query.archived !== undefined) {
        filters.archived = req.query.archived === 'true';
      }

      const result = await notificationService.getByUser(userId, filters, page, limit);

      return res.status(200).json({
        status: 'success',
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Buscar notificações críticas não lidas
   */
  async getCritical(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;
      const notifications = await notificationService.getCriticalUnread(userId);

      return res.status(200).json({
        status: 'success',
        data: notifications,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Contar notificações não lidas
   */
  async countUnread(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;
      const count = await notificationService.countUnread(userId);

      return res.status(200).json({
        status: 'success',
        data: { count },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Contar por prioridade
   */
  async countByPriority(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;
      const counts = await notificationService.countByPriority(userId);

      return res.status(200).json({
        status: 'success',
        data: counts,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Marcar notificação como lida
   */
  async markAsRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;
      const { id } = req.params;

      const notification = await notificationService.markAsRead(id, userId);

      return res.status(200).json({
        status: 'success',
        message: 'Notificação marcada como lida',
        data: notification,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Marcar todas como lidas
   */
  async markAllAsRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;
      await notificationService.markAllAsRead(userId);

      return res.status(200).json({
        status: 'success',
        message: 'Todas as notificações foram marcadas como lidas',
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Arquivar notificação
   */
  async archive(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;
      const { id } = req.params;

      const notification = await notificationService.archive(id, userId);

      return res.status(200).json({
        status: 'success',
        message: 'Notificação arquivada',
        data: notification,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Obter métricas de notificações
   */
  async getMetrics(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;
      const days = parseInt(req.query.days as string) || 7;

      const metrics = await notificationService.getMetrics(userId, days);

      return res.status(200).json({
        status: 'success',
        data: metrics,
      });
    } catch (error) {
      return next(error);
    }
  }
}

export default new NotificationController();
