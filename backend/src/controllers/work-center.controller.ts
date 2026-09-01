import { Request, Response, NextFunction } from 'express';
import workCenterService from '../services/work-center.service';

export class WorkCenterController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const workCenter = await workCenterService.create(req.body);
      res.status(201).json({ status: 'success', data: workCenter });
    } catch (error) {
      next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 100;
      const filters = {
        type: req.query.type as string,
        active: req.query.active === 'true' ? true : req.query.active === 'false' ? false : undefined,
        search: req.query.search as string,
      };
      const result = await workCenterService.getAll(page, limit, filters);
      res.status(200).json({ status: 'success', data: result.data, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const workCenter = await workCenterService.getById(req.params.id);
      if (!workCenter) {
        return res.status(404).json({ status: 'error', message: 'Centro de trabalho não encontrado' });
      }
      res.status(200).json({ status: 'success', data: workCenter });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const workCenter = await workCenterService.update(req.params.id, req.body);
      res.status(200).json({ status: 'success', data: workCenter });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await workCenterService.delete(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  async toggleActive(req: Request, res: Response, next: NextFunction) {
    try {
      const workCenter = await workCenterService.toggleActive(req.params.id);
      res.status(200).json({ status: 'success', data: workCenter });
    } catch (error) {
      next(error);
    }
  }
}

export default new WorkCenterController();
