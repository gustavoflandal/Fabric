import { Request, Response, NextFunction } from 'express';
import maintenancePlanService from '../services/maintenance-plan.service';

export class MaintenancePlanController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const plan = await maintenancePlanService.create(req.body);
      res.status(201).json({ status: 'success', data: plan });
    } catch (error) {
      next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 100;
      const filters = {
        equipmentId: req.query.equipmentId as string,
        active: req.query.active === 'true' ? true : req.query.active === 'false' ? false : undefined,
      };
      const result = await maintenancePlanService.getAll(page, limit, filters);
      res.status(200).json({ status: 'success', data: result.data, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const plan = await maintenancePlanService.getById(req.params.id);
      if (!plan) {
        return res.status(404).json({ status: 'error', message: 'Plano de manutenção não encontrado' });
      }
      res.status(200).json({ status: 'success', data: plan });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const plan = await maintenancePlanService.update(req.params.id, req.body);
      res.status(200).json({ status: 'success', data: plan });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await maintenancePlanService.delete(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  async toggleActive(req: Request, res: Response, next: NextFunction) {
    try {
      const plan = await maintenancePlanService.toggleActive(req.params.id);
      res.status(200).json({ status: 'success', data: plan });
    } catch (error) {
      next(error);
    }
  }
}

export default new MaintenancePlanController();
