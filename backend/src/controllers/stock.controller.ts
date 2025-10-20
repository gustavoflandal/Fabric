import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import stockService from '../services/stock.service';

export class StockController {
  async getBalance(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { productId } = req.params;
      const balance = await stockService.getBalance(productId);
      return res.status(200).json({ status: 'success', data: balance });
    } catch (error) {
      return next(error);
    }
  }

  async getAllBalances(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const filters = {
        status: req.query.status as any,
        type: req.query.type as string,
        categoryId: req.query.categoryId as string,
      };
      const balances = await stockService.getAllBalances(filters);
      return res.status(200).json({ status: 'success', data: balances });
    } catch (error) {
      return next(error);
    }
  }

  async registerEntry(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ status: 'error', message: 'Usuário não autenticado' });
      }

      const movement = await stockService.registerEntry({ ...req.body, userId });
      return res.status(201).json({
        status: 'success',
        message: 'Entrada registrada com sucesso',
        data: movement,
      });
    } catch (error) {
      return next(error);
    }
  }

  async registerExit(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ status: 'error', message: 'Usuário não autenticado' });
      }

      const movement = await stockService.registerExit({ ...req.body, userId });
      return res.status(201).json({
        status: 'success',
        message: 'Saída registrada com sucesso',
        data: movement,
      });
    } catch (error) {
      return next(error);
    }
  }

  async registerAdjustment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ status: 'error', message: 'Usuário não autenticado' });
      }

      const movement = await stockService.registerAdjustment({ ...req.body, userId });
      return res.status(201).json({
        status: 'success',
        message: 'Ajuste registrado com sucesso',
        data: movement,
      });
    } catch (error) {
      return next(error);
    }
  }

  async getMovements(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { productId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      const movements = await stockService.getMovements(productId, limit);
      return res.status(200).json({ status: 'success', data: movements });
    } catch (error) {
      return next(error);
    }
  }

  async getLowStock(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const products = await stockService.getLowStockProducts();
      return res.status(200).json({ status: 'success', data: products });
    } catch (error) {
      return next(error);
    }
  }

  async getExcessStock(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const products = await stockService.getExcessStockProducts();
      return res.status(200).json({ status: 'success', data: products });
    } catch (error) {
      return next(error);
    }
  }

  async getSummary(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const summary = await stockService.getSummary();
      return res.status(200).json({ status: 'success', data: summary });
    } catch (error) {
      return next(error);
    }
  }

  async reserveForOrder(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ status: 'error', message: 'Usuário não autenticado' });
      }

      const { orderId } = req.params;
      const result = await stockService.reserveForOrder(orderId, userId);
      return res.status(200).json({
        status: 'success',
        message: 'Estoque reservado com sucesso',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }
}

export default new StockController();
