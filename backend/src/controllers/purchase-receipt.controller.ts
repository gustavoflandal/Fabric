import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import purchaseReceiptService from '../services/purchase-receipt.service';

export class PurchaseReceiptController {
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const receipt = await purchaseReceiptService.create(req.body, req.user!.id);
      
      return res.status(201).json({
        status: 'success',
        message: 'Recebimento registrado com sucesso',
        data: receipt,
      });
    } catch (error) {
      return next(error);
    }
  }

  async getAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { purchaseOrderId, startDate, endDate } = req.query;

      const receipts = await purchaseReceiptService.getAll({
        purchaseOrderId: purchaseOrderId as string,
        startDate: startDate as string,
        endDate: endDate as string,
      });

      return res.status(200).json({
        status: 'success',
        data: receipts,
      });
    } catch (error) {
      return next(error);
    }
  }

  async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const receipt = await purchaseReceiptService.getById(req.params.id);

      return res.status(200).json({
        status: 'success',
        data: receipt,
      });
    } catch (error) {
      return next(error);
    }
  }

  async cancel(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { reason } = req.body;

      await purchaseReceiptService.cancel(req.params.id, req.user!.id, reason);

      return res.status(200).json({
        status: 'success',
        message: 'Recebimento cancelado com sucesso',
      });
    } catch (error) {
      return next(error);
    }
  }
}

export default new PurchaseReceiptController();
