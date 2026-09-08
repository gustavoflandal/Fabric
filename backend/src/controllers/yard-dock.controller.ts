import { Request, Response, NextFunction } from 'express';
import yardDockService from '../services/yard-dock.service';

export class YardDockController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const dock = await yardDockService.create(req.body);
      res.status(201).json({ status: 'success', data: dock });
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
        serviceType: req.query.serviceType as 'RECEBIMENTO' | 'EXPEDICAO' | 'MULTIUSO' | undefined,
        active: req.query.active === 'true' ? true : req.query.active === 'false' ? false : undefined,
      };
      const result = await yardDockService.getAll(page, limit, filters);
      res.status(200).json({ status: 'success', data: result.data, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const dock = await yardDockService.getById(req.params.id);
      if (!dock) {
        return res.status(404).json({ status: 'error', message: 'Doca não encontrada' });
      }
      res.status(200).json({ status: 'success', data: dock });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const dock = await yardDockService.update(req.params.id, req.body);
      res.status(200).json({ status: 'success', data: dock });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await yardDockService.delete(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}

export default new YardDockController();
