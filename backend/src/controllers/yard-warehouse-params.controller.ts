import { Request, Response, NextFunction } from 'express';
import yardWarehouseParamsService from '../services/yard-warehouse-params.service';

export class YardWarehouseParamsController {
  async getByWarehouseId(req: Request, res: Response, next: NextFunction) {
    try {
      const params = await yardWarehouseParamsService.getByWarehouseId(req.params.warehouseId);
      res.status(200).json({ status: 'success', data: params });
    } catch (error) {
      next(error);
    }
  }

  async upsert(req: Request, res: Response, next: NextFunction) {
    try {
      const params = await yardWarehouseParamsService.upsert(req.params.warehouseId, req.body);
      res.status(200).json({ status: 'success', data: params });
    } catch (error) {
      next(error);
    }
  }
}

export default new YardWarehouseParamsController();
