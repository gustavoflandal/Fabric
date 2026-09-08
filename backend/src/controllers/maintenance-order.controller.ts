import { Request, Response, NextFunction } from 'express';
import maintenanceOrderService from '../services/maintenance-order.service';

export class MaintenanceOrderController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const order = await maintenanceOrderService.createCorrective(req.body);
      res.status(201).json({ status: 'success', data: order });
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
        type: req.query.type as 'PREVENTIVE' | 'CORRECTIVE' | undefined,
        status: req.query.status as any,
      };
      const result = await maintenanceOrderService.getAll(page, limit, filters);
      res.status(200).json({ status: 'success', data: result.data, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const order = await maintenanceOrderService.getById(req.params.id);
      if (!order) {
        return res.status(404).json({ status: 'error', message: 'Ordem de manutenção não encontrada' });
      }
      res.status(200).json({ status: 'success', data: order });
    } catch (error) {
      next(error);
    }
  }

  async start(req: Request, res: Response, next: NextFunction) {
    try {
      const order = await maintenanceOrderService.start(req.params.id);
      res.status(200).json({ status: 'success', data: order });
    } catch (error) {
      next(error);
    }
  }

  async complete(req: Request, res: Response, next: NextFunction) {
    try {
      const order = await maintenanceOrderService.complete(req.params.id, req.body.resolutionNotes);
      res.status(200).json({ status: 'success', data: order });
    } catch (error) {
      next(error);
    }
  }

  async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const order = await maintenanceOrderService.cancel(req.params.id, req.body.reason);
      res.status(200).json({ status: 'success', data: order });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const order = await maintenanceOrderService.updateAssignee(req.params.id, req.body.assignedTo ?? null);
      res.status(200).json({ status: 'success', data: order });
    } catch (error) {
      next(error);
    }
  }
}

export default new MaintenanceOrderController();
