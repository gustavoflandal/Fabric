import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import purchaseOrderService from '../services/purchase-order.service';

export class PurchaseOrderController {
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ status: 'error', message: 'Usuário não autenticado' });
      }

      const order = await purchaseOrderService.create(req.body, userId);
      return res.status(201).json({
        status: 'success',
        message: 'Pedido de compra criado com sucesso',
        data: order,
      });
    } catch (error) {
      return next(error);
    }
  }

  async createFromQuotation(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ status: 'error', message: 'Usuário não autenticado' });
      }

      const { quotationId } = req.body;
      const order = await purchaseOrderService.createFromQuotation(quotationId, userId);
      return res.status(201).json({
        status: 'success',
        message: 'Pedido criado a partir do orçamento',
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
        supplierId: req.query.supplierId as string,
        status: req.query.status as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
      };

      const result = await purchaseOrderService.getAll(page, limit, filters);
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
      const order = await purchaseOrderService.getById(req.params.id);
      return res.status(200).json({
        status: 'success',
        data: order,
      });
    } catch (error) {
      return next(error);
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const order = await purchaseOrderService.update(req.params.id, req.body);
      return res.status(200).json({
        status: 'success',
        message: 'Pedido atualizado com sucesso',
        data: order,
      });
    } catch (error) {
      return next(error);
    }
  }

  async updateStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { status } = req.body;
      const order = await purchaseOrderService.updateStatus(req.params.id, status);
      return res.status(200).json({
        status: 'success',
        message: 'Status atualizado com sucesso',
        data: order,
      });
    } catch (error) {
      return next(error);
    }
  }

  async approve(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const order = await purchaseOrderService.updateStatus(req.params.id, 'APPROVED');
      return res.status(200).json({
        status: 'success',
        message: 'Pedido aprovado com sucesso',
        data: order,
      });
    } catch (error) {
      return next(error);
    }
  }

  async confirm(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const order = await purchaseOrderService.confirm(req.params.id);
      return res.status(200).json({
        status: 'success',
        message: 'Pedido confirmado com sucesso',
        data: order,
      });
    } catch (error) {
      return next(error);
    }
  }

  async cancel(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const order = await purchaseOrderService.cancel(req.params.id);
      return res.status(200).json({
        status: 'success',
        message: 'Pedido cancelado com sucesso',
        data: order,
      });
    } catch (error) {
      return next(error);
    }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await purchaseOrderService.delete(req.params.id);
      return res.status(200).json({
        status: 'success',
        message: 'Pedido excluído com sucesso',
      });
    } catch (error) {
      return next(error);
    }
  }

  async getBySupplier(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const orders = await purchaseOrderService.getBySupplier(req.params.supplierId);
      return res.status(200).json({
        status: 'success',
        data: orders,
      });
    } catch (error) {
      return next(error);
    }
  }

  async getPendingOrders(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const orders = await purchaseOrderService.getPendingOrders();
      return res.status(200).json({
        status: 'success',
        data: orders,
      });
    } catch (error) {
      return next(error);
    }
  }
}

export default new PurchaseOrderController();
