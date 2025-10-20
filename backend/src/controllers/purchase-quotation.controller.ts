import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import purchaseQuotationService from '../services/purchase-quotation.service';

export class PurchaseQuotationController {
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ status: 'error', message: 'Usuário não autenticado' });
      }

      const quotation = await purchaseQuotationService.create(req.body, userId);
      return res.status(201).json({
        status: 'success',
        message: 'Orçamento criado com sucesso',
        data: quotation,
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

      const result = await purchaseQuotationService.getAll(page, limit, filters);
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
      const quotation = await purchaseQuotationService.getById(req.params.id);
      return res.status(200).json({
        status: 'success',
        data: quotation,
      });
    } catch (error) {
      return next(error);
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const quotation = await purchaseQuotationService.update(req.params.id, req.body);
      return res.status(200).json({
        status: 'success',
        message: 'Orçamento atualizado com sucesso',
        data: quotation,
      });
    } catch (error) {
      return next(error);
    }
  }

  async updateStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { status } = req.body;
      const quotation = await purchaseQuotationService.updateStatus(req.params.id, status);
      return res.status(200).json({
        status: 'success',
        message: 'Status atualizado com sucesso',
        data: quotation,
      });
    } catch (error) {
      return next(error);
    }
  }

  async approve(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const quotation = await purchaseQuotationService.updateStatus(req.params.id, 'APPROVED');
      return res.status(200).json({
        status: 'success',
        message: 'Orçamento aprovado com sucesso',
        data: quotation,
      });
    } catch (error) {
      return next(error);
    }
  }

  async reject(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const quotation = await purchaseQuotationService.updateStatus(req.params.id, 'REJECTED');
      return res.status(200).json({
        status: 'success',
        message: 'Orçamento rejeitado',
        data: quotation,
      });
    } catch (error) {
      return next(error);
    }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await purchaseQuotationService.delete(req.params.id);
      return res.status(200).json({
        status: 'success',
        message: 'Orçamento excluído com sucesso',
      });
    } catch (error) {
      return next(error);
    }
  }

  async getBySupplier(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const quotations = await purchaseQuotationService.getBySupplier(req.params.supplierId);
      return res.status(200).json({
        status: 'success',
        data: quotations,
      });
    } catch (error) {
      return next(error);
    }
  }
}

export default new PurchaseQuotationController();
