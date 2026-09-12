import { Request, Response, NextFunction } from 'express';
import yardVisitService from '../services/yard-visit.service';

export class YardVisitController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const visit = await yardVisitService.create({ ...req.body, scheduledAt: new Date(req.body.scheduledAt) });
      res.status(201).json({ status: 'success', data: visit });
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
        status: req.query.status as any,
        serviceType: req.query.serviceType as any,
        vehicleId: req.query.vehicleId as string,
      };
      const result = await yardVisitService.getAll(page, limit, filters);
      res.status(200).json({ status: 'success', data: result.data, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const visit = await yardVisitService.getById(req.params.id);
      if (!visit) {
        return res.status(404).json({ status: 'error', message: 'Visita não encontrada' });
      }
      res.status(200).json({ status: 'success', data: visit });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const data = { ...req.body };
      if (data.scheduledAt) data.scheduledAt = new Date(data.scheduledAt);
      const visit = await yardVisitService.update(req.params.id, data);
      res.status(200).json({ status: 'success', data: visit });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await yardVisitService.delete(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  async checkIn(req: Request, res: Response, next: NextFunction) {
    try {
      const visit = await yardVisitService.checkIn(req.params.id, req.body);
      res.status(200).json({ status: 'success', data: visit });
    } catch (error) {
      next(error);
    }
  }

  async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const visit = await yardVisitService.cancel(req.params.id);
      res.status(200).json({ status: 'success', data: visit });
    } catch (error) {
      next(error);
    }
  }
}

export default new YardVisitController();
