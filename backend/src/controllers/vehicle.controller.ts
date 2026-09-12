import { Request, Response, NextFunction } from 'express';
import vehicleService from '../services/vehicle.service';

export class VehicleController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const vehicle = await vehicleService.create(req.body);
      res.status(201).json({ status: 'success', data: vehicle });
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
        fleetId: req.query.fleetId as string,
        type: req.query.type as any,
        blocked: req.query.blocked === 'true' ? true : req.query.blocked === 'false' ? false : undefined,
        search: req.query.search as string,
      };
      const result = await vehicleService.getAll(page, limit, filters);
      res.status(200).json({ status: 'success', data: result.data, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const vehicle = await vehicleService.getById(req.params.id);
      if (!vehicle) {
        return res.status(404).json({ status: 'error', message: 'Veículo não encontrado' });
      }
      res.status(200).json({ status: 'success', data: vehicle });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const vehicle = await vehicleService.update(req.params.id, req.body);
      res.status(200).json({ status: 'success', data: vehicle });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await vehicleService.delete(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  async setBlocked(req: Request, res: Response, next: NextFunction) {
    try {
      const vehicle = await vehicleService.setBlocked(req.params.id, req.body.blocked, req.body.blockedReason ?? null);
      res.status(200).json({ status: 'success', data: vehicle });
    } catch (error) {
      next(error);
    }
  }
}

export default new VehicleController();
