import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import reportsService from '../services/reports.service';

export class ReportsController {
  async getProductionReport(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({
          status: 'error',
          message: 'startDate e endDate são obrigatórios',
        });
      }

      const report = await reportsService.getProductionReport(
        startDate as string,
        endDate as string
      );
      
      return res.status(200).json({ status: 'success', data: report });
    } catch (error) {
      return next(error);
    }
  }

  async getEfficiencyReport(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({
          status: 'error',
          message: 'startDate e endDate são obrigatórios',
        });
      }

      const report = await reportsService.getEfficiencyReport(
        startDate as string,
        endDate as string
      );
      
      return res.status(200).json({ status: 'success', data: report });
    } catch (error) {
      return next(error);
    }
  }

  async getQualityReport(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({
          status: 'error',
          message: 'startDate e endDate são obrigatórios',
        });
      }

      const report = await reportsService.getQualityReport(
        startDate as string,
        endDate as string
      );
      
      return res.status(200).json({ status: 'success', data: report });
    } catch (error) {
      return next(error);
    }
  }

  async getWorkCenterReport(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({
          status: 'error',
          message: 'startDate e endDate são obrigatórios',
        });
      }

      const report = await reportsService.getWorkCenterReport(
        startDate as string,
        endDate as string
      );
      
      return res.status(200).json({ status: 'success', data: report });
    } catch (error) {
      return next(error);
    }
  }

  async getConsolidatedReport(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({
          status: 'error',
          message: 'startDate e endDate são obrigatórios',
        });
      }

      const report = await reportsService.getConsolidatedReport(
        startDate as string,
        endDate as string
      );
      
      return res.status(200).json({ status: 'success', data: report });
    } catch (error) {
      return next(error);
    }
  }
}

export default new ReportsController();
