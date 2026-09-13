import { Request, Response, NextFunction } from 'express';
import yardDashboardService from '../services/yard-dashboard.service';

export class YardDashboardController {
  async getDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const warehouseId = req.query.warehouseId as string;
      const days = req.query.days ? Number(req.query.days) : undefined;
      const dashboard = await yardDashboardService.getDashboard(warehouseId, days);
      res.status(200).json({ status: 'success', data: dashboard });
    } catch (error) {
      next(error);
    }
  }
}

export default new YardDashboardController();
