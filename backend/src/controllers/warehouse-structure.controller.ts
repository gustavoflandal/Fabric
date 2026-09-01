import { Request, Response, NextFunction } from 'express';
import warehouseStructureService from '../services/warehouse-structure.service';

export class WarehouseStructureController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const structure = await warehouseStructureService.create(req.body);
      res.status(201).json({ status: 'success', data: structure });
    } catch (error) {
      next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 100;
      const filters = {
        blocked: req.query.blocked === 'true' ? true : req.query.blocked === 'false' ? false : undefined,
        search: req.query.search as string,
      };

      const result = await warehouseStructureService.getAll(page, limit, filters);
      res.status(200).json({ status: 'success', data: result.data, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const structure = await warehouseStructureService.getById(req.params.id);
      if (!structure) {
        return res.status(404).json({ status: 'error', message: 'Estrutura não encontrada' });
      }
      res.status(200).json({ status: 'success', data: structure });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const structure = await warehouseStructureService.update(req.params.id, req.body);
      res.status(200).json({ status: 'success', data: structure });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await warehouseStructureService.delete(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}

export default new WarehouseStructureController();