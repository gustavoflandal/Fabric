import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import salesOrderService from '../services/sales-order.service';

export class SalesOrderController {
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ status: 'error', message: 'Usuário não autenticado' });
      }

      const order = await salesOrderService.create(req.body, userId);
      return res.status(201).json({
        status: 'success',
        message: 'Pedido de venda criado com sucesso',
        data: order,
      });
    } catch (error) {
      return next(error);
    }
  }

  async getAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const filters = {
        status: req.query.status as string,
        customerId: req.query.customerId as string,
        search: req.query.search as string,
      };

      const result = await salesOrderService.getAll(page, limit, filters);
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
      const order = await salesOrderService.getById(req.params.id);
      return res.status(200).json({ status: 'success', data: order });
    } catch (error) {
      return next(error);
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const order = await salesOrderService.update(req.params.id, req.body);
      return res.status(200).json({
        status: 'success',
        message: 'Pedido de venda atualizado com sucesso',
        data: order,
      });
    } catch (error) {
      return next(error);
    }
  }

  async confirm(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const order = await salesOrderService.confirm(req.params.id);
      return res.status(200).json({
        status: 'success',
        message: 'Pedido de venda confirmado com sucesso',
        data: order,
      });
    } catch (error) {
      return next(error);
    }
  }

  async cancel(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const order = await salesOrderService.cancel(req.params.id);
      return res.status(200).json({
        status: 'success',
        message: 'Pedido de venda cancelado com sucesso',
        data: order,
      });
    } catch (error) {
      return next(error);
    }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await salesOrderService.delete(req.params.id);
      return res.status(200).json({
        status: 'success',
        message: 'Pedido de venda excluído com sucesso',
      });
    } catch (error) {
      return next(error);
    }
  }
}

export default new SalesOrderController();
