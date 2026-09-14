import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import shipmentService from '../services/shipment.service';

export class ShipmentController {
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ status: 'error', message: 'Usuário não autenticado' });
      }

      const shipment = await shipmentService.create(req.body, userId);
      return res.status(201).json({
        status: 'success',
        message: 'Romaneio criado com sucesso',
        data: shipment,
      });
    } catch (error) {
      return next(error);
    }
  }

  async getAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const filters = {
        status: req.query.status as string,
        salesOrderId: req.query.salesOrderId as string,
        warehouseId: req.query.warehouseId as string,
      };

      const result = await shipmentService.getAll(page, limit, filters);
      return res.status(200).json({
        status: 'success',
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      return next(error);
    }
  }

  async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const shipment = await shipmentService.getById(req.params.id);
      return res.status(200).json({ status: 'success', data: shipment });
    } catch (error) {
      return next(error);
    }
  }

  async startSeparation(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const shipment = await shipmentService.startSeparation(req.params.id);
      return res.status(200).json({
        status: 'success',
        message: 'Separação iniciada e tarefas de picking geradas',
        data: shipment,
      });
    } catch (error) {
      return next(error);
    }
  }

  async dispatch(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const shipment = await shipmentService.dispatch(req.params.id);
      return res.status(200).json({
        status: 'success',
        message: 'Romaneio despachado com sucesso',
        data: shipment,
      });
    } catch (error) {
      return next(error);
    }
  }

  async cancel(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const shipment = await shipmentService.cancel(req.params.id);
      return res.status(200).json({
        status: 'success',
        message: 'Romaneio cancelado com sucesso',
        data: shipment,
      });
    } catch (error) {
      return next(error);
    }
  }
}

export default new ShipmentController();
