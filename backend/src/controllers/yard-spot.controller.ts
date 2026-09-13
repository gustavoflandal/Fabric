import { Request, Response, NextFunction } from 'express';
import yardSpotService from '../services/yard-spot.service';

export class YardSpotController {
  async generateBatch(req: Request, res: Response, next: NextFunction) {
    try {
      const spots = await yardSpotService.generateBatch(req.params.areaId, req.body.count);
      res.status(201).json({ status: 'success', data: spots });
    } catch (error) {
      next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 100;
      const filters = {
        areaId: req.query.areaId as string,
        blocked: req.query.blocked === 'true' ? true : req.query.blocked === 'false' ? false : undefined,
      };
      const result = await yardSpotService.getAll(page, limit, filters);
      res.status(200).json({ status: 'success', data: result.data, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const spot = await yardSpotService.getById(req.params.id);
      if (!spot) return res.status(404).json({ status: 'error', message: 'Vaga não encontrada' });
      res.status(200).json({ status: 'success', data: spot });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const spot = await yardSpotService.update(req.params.id, req.body);
      res.status(200).json({ status: 'success', data: spot });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await yardSpotService.delete(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  async setBlocked(req: Request, res: Response, next: NextFunction) {
    try {
      const spot = await yardSpotService.setBlocked(req.params.id, req.body.blocked, req.body.blockedReason ?? null);
      res.status(200).json({ status: 'success', data: spot });
    } catch (error) {
      next(error);
    }
  }
}

export default new YardSpotController();
