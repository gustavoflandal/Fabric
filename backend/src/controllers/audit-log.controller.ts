import { Request, Response, NextFunction } from 'express';
import auditLogService from '../services/audit-log.service';

export class AuditLogController {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 100;

      // Processar datas corretamente
      let startDate: Date | undefined;
      let endDate: Date | undefined;

      if (req.query.startDate) {
        // Criar data no timezone local (sem conversão UTC)
        const [year, month, day] = (req.query.startDate as string).split('-').map(Number);
        startDate = new Date(year, month - 1, day, 0, 0, 0, 0);
      }

      if (req.query.endDate) {
        // Criar data no timezone local (sem conversão UTC)
        const [year, month, day] = (req.query.endDate as string).split('-').map(Number);
        endDate = new Date(year, month - 1, day, 23, 59, 59, 999);
      }

      const filters = {
        userId: req.query.userId as string,
        resource: req.query.resource as string,
        action: req.query.action as string,
        startDate,
        endDate,
      };

      const result = await auditLogService.getAll(page, limit, filters);

      res.status(200).json({
        status: 'success',
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      console.error('❌ Erro ao buscar logs:', error);
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const log = await auditLogService.getById(req.params.id);

      if (!log) {
        return res.status(404).json({
          status: 'error',
          message: 'Log não encontrado',
        });
      }

      res.status(200).json({
        status: 'success',
        data: log,
      });
    } catch (error) {
      next(error);
    }
  }

  async getByResource(req: Request, res: Response, next: NextFunction) {
    try {
      const { resource, resourceId } = req.params;
      const logs = await auditLogService.getByResource(resource, resourceId);

      res.status(200).json({
        status: 'success',
        data: logs,
      });
    } catch (error) {
      next(error);
    }
  }

  async getStatistics(req: Request, res: Response, next: NextFunction) {
    try {
      // Processar datas corretamente
      let startDate: Date | undefined;
      let endDate: Date | undefined;

      if (req.query.startDate) {
        const [year, month, day] = (req.query.startDate as string).split('-').map(Number);
        startDate = new Date(year, month - 1, day, 0, 0, 0, 0);
      }

      if (req.query.endDate) {
        const [year, month, day] = (req.query.endDate as string).split('-').map(Number);
        endDate = new Date(year, month - 1, day, 23, 59, 59, 999);
      }

      const statistics = await auditLogService.getStatistics(
        startDate,
        endDate
      );

      res.status(200).json({
        status: 'success',
        data: statistics,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = req.body;

      if (!startDate || !endDate) {
        return res.status(400).json({
          status: 'error',
          message: 'startDate e endDate são obrigatórios',
        });
      }

      const result = await auditLogService.deleteLogs(
        new Date(startDate),
        new Date(endDate)
      );

      res.status(200).json({
        status: 'success',
        data: result,
        message: `${result.count} logs excluídos com sucesso`,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new AuditLogController();
