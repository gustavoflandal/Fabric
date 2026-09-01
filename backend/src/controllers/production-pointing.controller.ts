import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import productionPointingService from '../services/production-pointing.service';

export class ProductionPointingController {
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ status: 'error', message: 'Usuário não autenticado' });
      }

      const pointing = await productionPointingService.create(req.body, userId);
      return res.status(201).json({
        status: 'success',
        message: 'Apontamento criado com sucesso',
        data: pointing,
      });
    } catch (error) {
      return next(error);
    }
  }

  async getAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 100;
      const filters = {
        productionOrderId: req.query.productionOrderId as string,
        operationId: req.query.operationId as string,
        workCenterId: req.query.workCenterId as string,
        userId: req.query.userId as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        status: req.query.status as 'IN_PROGRESS' | 'COMPLETED' | undefined,
      };

      const result = await productionPointingService.getAll(page, limit, filters);
      return res.status(200).json({
        status: 'success',
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      return next(error);
    }
  }

  async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const pointing = await productionPointingService.getById(req.params.id);
      if (!pointing) {
        return res.status(404).json({ status: 'error', message: 'Apontamento não encontrado' });
      }
      return res.status(200).json({ status: 'success', data: pointing });
    } catch (error) {
      return next(error);
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const pointing = await productionPointingService.update(req.params.id, req.body);
      return res.status(200).json({
        status: 'success',
        message: 'Apontamento atualizado com sucesso',
        data: pointing,
      });
    } catch (error) {
      return next(error);
    }
  }

  async finish(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const pointing = await productionPointingService.finish(req.params.id, req.body);
      return res.status(200).json({
        status: 'success',
        message: 'Apontamento finalizado com sucesso',
        data: pointing,
      });
    } catch (error) {
      return next(error);
    }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await productionPointingService.delete(req.params.id);
      return res.status(204).send();
    } catch (error) {
      return next(error);
    }
  }

  async getByOrder(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const pointings = await productionPointingService.getByOrder(req.params.orderId);
      return res.status(200).json({ status: 'success', data: pointings });
    } catch (error) {
      return next(error);
    }
  }

  async getByOperator(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.params.userId;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      const pointings = await productionPointingService.getByOperator(userId, startDate, endDate);
      return res.status(200).json({ status: 'success', data: pointings });
    } catch (error) {
      return next(error);
    }
  }

  async getMyPointings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ status: 'error', message: 'Usuário não autenticado' });
      }

      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      const pointings = await productionPointingService.getByOperator(userId, startDate, endDate);
      return res.status(200).json({ status: 'success', data: pointings });
    } catch (error) {
      return next(error);
    }
  }
}

export default new ProductionPointingController();
