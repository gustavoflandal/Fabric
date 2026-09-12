import { Request, Response, NextFunction } from 'express';
import fleetService from '../services/fleet.service';

export class FleetController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const fleet = await fleetService.create(req.body);
      res.status(201).json({ status: 'success', data: fleet });
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
      };
      const result = await fleetService.getAll(page, limit, filters);
      res.status(200).json({ status: 'success', data: result.data, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const fleet = await fleetService.getById(req.params.id);
      if (!fleet) {
        return res.status(404).json({ status: 'error', message: 'Frota não encontrada' });
      }
      res.status(200).json({ status: 'success', data: fleet });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const fleet = await fleetService.update(req.params.id, req.body);
      res.status(200).json({ status: 'success', data: fleet });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await fleetService.delete(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  async setBlocked(req: Request, res: Response, next: NextFunction) {
    try {
      const fleet = await fleetService.setBlocked(req.params.id, req.body.blocked, req.body.blockedReason ?? null);
      res.status(200).json({ status: 'success', data: fleet });
    } catch (error) {
      next(error);
    }
  }
}

export default new FleetController();
