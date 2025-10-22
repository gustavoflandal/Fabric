import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import mrpService from '../services/mrp.service';
import { AppError } from '../middleware/error.middleware';
import { parseJsonSafely, validateStringArray } from '../utils/validation.util';

export class MRPController {
  async executeForOrder(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { orderId } = req.params;
      const result = await mrpService.executeForOrder(orderId);
      return res.status(200).json({ status: 'success', data: result });
    } catch (error) {
      return next(error);
    }
  }

  async executeForMultipleOrders(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { orderIds } = req.body;
      const results = await mrpService.executeForMultipleOrders(orderIds);
      return res.status(200).json({ status: 'success', data: results });
    } catch (error) {
      return next(error);
    }
  }

  async executeForAllPending(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const results = await mrpService.executeForAllPendingOrders();
      return res.status(200).json({ status: 'success', data: results });
    } catch (error) {
      return next(error);
    }
  }

  async consolidateRequirements(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { orderIds } = req.body;
      const requirements = await mrpService.consolidateRequirements(orderIds);
      return res.status(200).json({ status: 'success', data: requirements });
    } catch (error) {
      return next(error);
    }
  }

  async generatePurchaseSuggestions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      let orderIds: string[] | undefined;
      
      if (req.query.orderIds) {
        try {
          const parsed = parseJsonSafely<string[]>(
            req.query.orderIds as string,
            'orderIds deve ser um array JSON válido'
          );
          
          validateStringArray(parsed, 'orderIds deve conter apenas IDs válidos');
          orderIds = parsed;
        } catch (error) {
          if (error instanceof Error) {
            throw new AppError(400, error.message);
          }
          throw error;
        }
      }
      
      const suggestions = await mrpService.generatePurchaseSuggestions(orderIds);
      return res.status(200).json({ status: 'success', data: suggestions });
    } catch (error) {
      return next(error);
    }
  }

  async generateProductionSuggestions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      let orderIds: string[] | undefined;
      
      if (req.query.orderIds) {
        try {
          const parsed = parseJsonSafely<string[]>(
            req.query.orderIds as string,
            'orderIds deve ser um array JSON válido'
          );
          
          validateStringArray(parsed, 'orderIds deve conter apenas IDs válidos');
          orderIds = parsed;
        } catch (error) {
          if (error instanceof Error) {
            throw new AppError(400, error.message);
          }
          throw error;
        }
      }
      
      const suggestions = await mrpService.generateProductionSuggestions(orderIds);
      return res.status(200).json({ status: 'success', data: suggestions });
    } catch (error) {
      return next(error);
    }
  }

  async getSummary(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const summary = await mrpService.getSummary();
      return res.status(200).json({ status: 'success', data: summary });
    } catch (error) {
      return next(error);
    }
  }
}

export default new MRPController();
