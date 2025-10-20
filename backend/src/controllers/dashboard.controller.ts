import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import dashboardService from '../services/dashboard.service';

export class DashboardController {
  async getStatistics(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const stats = await dashboardService.getStatistics();
      return res.status(200).json({ status: 'success', data: stats });
    } catch (error) {
      return next(error);
    }
  }

  async getProductionMetrics(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const metrics = await dashboardService.getProductionMetrics();
      return res.status(200).json({ status: 'success', data: metrics });
    } catch (error) {
      return next(error);
    }
  }

  async getWorkCenterMetrics(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const metrics = await dashboardService.getWorkCenterMetrics();
      return res.status(200).json({ status: 'success', data: metrics });
    } catch (error) {
      return next(error);
    }
  }

  async getTopProducts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const limit = parseInt(req.query.limit as string) || 5;
      const products = await dashboardService.getTopProducts(limit);
      return res.status(200).json({ status: 'success', data: products });
    } catch (error) {
      return next(error);
    }
  }

  async getRecentActivity(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const activity = await dashboardService.getRecentActivity(limit);
      return res.status(200).json({ status: 'success', data: activity });
    } catch (error) {
      return next(error);
    }
  }

  async getProductionTrend(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const days = parseInt(req.query.days as string) || 7;
      const trend = await dashboardService.getProductionTrend(days);
      return res.status(200).json({ status: 'success', data: trend });
    } catch (error) {
      return next(error);
    }
  }
}

export default new DashboardController();
