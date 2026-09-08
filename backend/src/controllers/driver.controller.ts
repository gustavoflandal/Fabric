import { Request, Response, NextFunction } from 'express';
import driverService from '../services/driver.service';

export class DriverController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const driver = await driverService.create(req.body);
      res.status(201).json({ status: 'success', data: driver });
    } catch (error) {
      next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 100;
      const filters = {
        supplierId: req.query.supplierId as string,
        blocked: req.query.blocked === 'true' ? true : req.query.blocked === 'false' ? false : undefined,
        search: req.query.search as string,
      };
      const result = await driverService.getAll(page, limit, filters);
      res.status(200).json({ status: 'success', data: result.data, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const driver = await driverService.getById(req.params.id);
      if (!driver) {
        return res.status(404).json({ status: 'error', message: 'Motorista não encontrado' });
      }
      res.status(200).json({ status: 'success', data: driver });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const driver = await driverService.update(req.params.id, req.body);
      res.status(200).json({ status: 'success', data: driver });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await driverService.delete(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  async setBlocked(req: Request, res: Response, next: NextFunction) {
    try {
      const driver = await driverService.setBlocked(req.params.id, req.body.blocked, req.body.blockedReason ?? null);
      res.status(200).json({ status: 'success', data: driver });
    } catch (error) {
      next(error);
    }
  }
}

export default new DriverController();
