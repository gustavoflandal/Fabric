import { Request, Response, NextFunction } from 'express';
import yardAreaService from '../services/yard-area.service';

export class YardAreaController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const area = await yardAreaService.create(req.body);
      res.status(201).json({ status: 'success', data: area });
    } catch (error) {
      next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 100;
      const filters = {
        warehouseId: req.query.warehouseId as string,
        blocked: req.query.blocked === 'true' ? true : req.query.blocked === 'false' ? false : undefined,
      };
      const result = await yardAreaService.getAll(page, limit, filters);
      res.status(200).json({ status: 'success', data: result.data, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const area = await yardAreaService.getById(req.params.id);
      if (!area) return res.status(404).json({ status: 'error', message: 'Área não encontrada' });
      res.status(200).json({ status: 'success', data: area });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const area = await yardAreaService.update(req.params.id, req.body);
      res.status(200).json({ status: 'success', data: area });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await yardAreaService.delete(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  async setBlocked(req: Request, res: Response, next: NextFunction) {
    try {
      const area = await yardAreaService.setBlocked(req.params.id, req.body.blocked, req.body.blockedReason ?? null);
      res.status(200).json({ status: 'success', data: area });
    } catch (error) {
      next(error);
    }
  }
}

export default new YardAreaController();
