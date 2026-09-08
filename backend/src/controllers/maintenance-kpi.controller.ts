import { Request, Response, NextFunction } from 'express';
import { getMaintenanceKpis } from '../services/maintenance-kpi.service';

export class MaintenanceKpiController {
  async getKpis(req: Request, res: Response, next: NextFunction) {
    try {
      const days = Number(req.query.days) || 90;
      const kpis = await getMaintenanceKpis(days);
      res.status(200).json({ status: 'success', data: kpis });
    } catch (error) {
      next(error);
    }
  }
}

export default new MaintenanceKpiController();
