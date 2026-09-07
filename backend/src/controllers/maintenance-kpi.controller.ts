import { Request, Response, NextFunction } from 'express';
import { getMaintenanceKpis } from '../services/maintenance-kpi.service';

export class MaintenanceKpiController {
  async getKpis(_req: Request, res: Response, next: NextFunction) {
    try {
      const kpis = await getMaintenanceKpis();
      res.status(200).json({ status: 'success', data: kpis });
    } catch (error) {
      next(error);
    }
  }
}

export default new MaintenanceKpiController();
