import { Request, Response, NextFunction } from 'express';
import equipmentService from '../services/equipment.service';

export class EquipmentController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const equipment = await equipmentService.create(req.body);
      res.status(201).json({ status: 'success', data: equipment });
    } catch (error) {
      next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 100;
      const filters = {
        workCenterId: req.query.workCenterId as string,
        active: req.query.active === 'true' ? true : req.query.active === 'false' ? false : undefined,
        search: req.query.search as string,
      };
      const result = await equipmentService.getAll(page, limit, filters);
      res.status(200).json({ status: 'success', data: result.data, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const equipment = await equipmentService.getById(req.params.id);
      if (!equipment) {
        return res.status(404).json({ status: 'error', message: 'Equipamento não encontrado' });
      }
      res.status(200).json({ status: 'success', data: equipment });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const equipment = await equipmentService.update(req.params.id, req.body);
      res.status(200).json({ status: 'success', data: equipment });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await equipmentService.delete(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  async toggleActive(req: Request, res: Response, next: NextFunction) {
    try {
      const equipment = await equipmentService.toggleActive(req.params.id);
      res.status(200).json({ status: 'success', data: equipment });
    } catch (error) {
      next(error);
    }
  }
}

export default new EquipmentController();
