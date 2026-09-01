import { Request, Response, NextFunction } from 'express';
import bomService from '../services/bom.service';

export class BomController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { productId, active } = req.query;
      const result = await bomService.list({
        productId: productId as string | undefined,
        active: active !== undefined ? active === 'true' : undefined,
      });
      return res.status(200).json({ status: 'success', data: result });
    } catch (error) {
      return next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const bom = await bomService.getById(req.params.id);
      return res.status(200).json({ status: 'success', data: bom });
    } catch (error) {
      return next(error);
    }
  }

  async getActiveByProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const bom = await bomService.getActiveByProduct(req.params.productId);
      return res.status(200).json({ status: 'success', data: bom });
    } catch (error) {
      return next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const bom = await bomService.create(req.body);
      return res.status(201).json({ status: 'success', data: bom, message: 'BOM criada com sucesso' });
    } catch (error) {
      return next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const bom = await bomService.update(req.params.id, req.body);
      return res.status(200).json({ status: 'success', data: bom, message: 'BOM atualizada com sucesso' });
    } catch (error) {
      return next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await bomService.delete(req.params.id);
      return res.status(200).json({ status: 'success', message: result.message });
    } catch (error) {
      return next(error);
    }
  }

  async setActive(req: Request, res: Response, next: NextFunction) {
    try {
      const bom = await bomService.setActive(req.params.id, req.body.active);
      return res.status(200).json({ status: 'success', data: bom, message: 'BOM atualizada com sucesso' });
    } catch (error) {
      return next(error);
    }
  }

  async explode(req: Request, res: Response, next: NextFunction) {
    try {
      const quantity = req.query.quantity ? Number(req.query.quantity) : 1;
      const explosion = await bomService.explode(req.params.id, quantity);
      return res.status(200).json({ status: 'success', data: explosion });
    } catch (error) {
      return next(error);
    }
  }
}

export default new BomController();
