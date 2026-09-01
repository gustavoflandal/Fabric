import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import productionOrderService from '../services/production-order.service';
import { parsePositiveInt } from '../utils/validation.util';

export class ProductionOrderController {
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ status: 'error', message: 'Usuário não autenticado' });
      }

      const order = await productionOrderService.create(req.body, userId);
      return res.status(201).json({
        status: 'success',
        message: 'Ordem de produção criada com sucesso',
        data: order,
      });
    } catch (error) {
      return next(error);
    }
  }

  async getAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = parsePositiveInt(req.query.page, 1);
      const limit = parsePositiveInt(req.query.limit, 100, 500);
      const filters = {
        status: req.query.status as string,
        productId: req.query.productId as string,
        priority: req.query.priority as string,
        search: req.query.search as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
      };

      const result = await productionOrderService.getAll(page, limit, filters);
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
      const order = await productionOrderService.getById(req.params.id);
      if (!order) {
        return res.status(404).json({ status: 'error', message: 'Ordem de produção não encontrada' });
      }
      return res.status(200).json({ status: 'success', data: order });
    } catch (error) {
      return next(error);
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const order = await productionOrderService.update(req.params.id, req.body);
      return res.status(200).json({
        status: 'success',
        message: 'Ordem de produção atualizada com sucesso',
        data: order,
      });
    } catch (error) {
      return next(error);
    }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await productionOrderService.delete(req.params.id);
      return res.status(204).send();
    } catch (error) {
      return next(error);
    }
  }

  async changeStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { status, notes } = req.body;
      const order = await productionOrderService.changeStatus(req.params.id, status, notes);
      return res.status(200).json({
        status: 'success',
        message: 'Status da ordem atualizado com sucesso',
        data: order,
      });
    } catch (error) {
      return next(error);
    }
  }

  async updateProgress(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { producedQuantity, scrapQuantity } = req.body;
      const order = await productionOrderService.updateProgress(
        req.params.id,
        producedQuantity,
        scrapQuantity || 0
      );
      return res.status(200).json({
        status: 'success',
        message: 'Progresso da ordem atualizado com sucesso',
        data: order,
      });
    } catch (error) {
      return next(error);
    }
  }

  async getOperations(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const operations = await productionOrderService.getOperations(req.params.id);
      return res.status(200).json({ status: 'success', data: operations });
    } catch (error) {
      return next(error);
    }
  }

  async getMaterials(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const materials = await productionOrderService.getMaterials(req.params.id);
      return res.status(200).json({ status: 'success', data: materials });
    } catch (error) {
      return next(error);
    }
  }

  async calculateMaterials(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const materials = await productionOrderService.calculateMaterials(req.params.id);
      return res.status(200).json({ status: 'success', data: materials });
    } catch (error) {
      return next(error);
    }
  }

  async calculateOperations(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const operations = await productionOrderService.calculateOperations(req.params.id);
      return res.status(200).json({ status: 'success', data: operations });
    } catch (error) {
      return next(error);
    }
  }
}

export default new ProductionOrderController();
