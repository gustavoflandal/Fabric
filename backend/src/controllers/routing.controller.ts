import { Request, Response, NextFunction } from 'express';
import routingService from '../services/routing.service';

export class RoutingController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const routing = await routingService.create(req.body);
      return res.status(201).json({ status: 'success', message: 'Roteiro criado com sucesso', data: routing });
    } catch (error) {
      return next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 100;
      const filters = {
        productId: req.query.productId as string,
        active: req.query.active === 'true' ? true : req.query.active === 'false' ? false : undefined,
        search: req.query.search as string,
      };

      const result = await routingService.getAll(page, limit, filters);
      return res.status(200).json({ status: 'success', data: result.data, pagination: result.pagination });
    } catch (error) {
      return next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const routing = await routingService.getById(req.params.id);
      if (!routing) {
        return res.status(404).json({ status: 'error', message: 'Roteiro não encontrado' });
      }
      return res.status(200).json({ status: 'success', data: routing });
    } catch (error) {
      return next(error);
    }
  }

  async getByProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const routings = await routingService.getByProduct(req.params.productId);
      return res.status(200).json({ status: 'success', data: routings });
    } catch (error) {
      return next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const routing = await routingService.update(req.params.id, req.body);
      return res.status(200).json({ status: 'success', message: 'Roteiro atualizado com sucesso', data: routing });
    } catch (error) {
      return next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await routingService.delete(req.params.id);
      return res.status(204).send();
    } catch (error) {
      return next(error);
    }
  }

  async setActive(req: Request, res: Response, next: NextFunction) {
    try {
      const { productId } = req.query;
      if (!productId) {
        return res.status(400).json({ status: 'error', message: 'productId é obrigatório' });
      }
      const routing = await routingService.setActive(req.params.id, productId as string, req.body.active);
      return res.status(200).json({ status: 'success', message: 'Status do roteiro atualizado', data: routing });
    } catch (error) {
      return next(error);
    }
  }

  async calculateTotalTime(req: Request, res: Response, next: NextFunction) {
    try {
      const quantity = parseInt(req.query.quantity as string) || 1;
      const result = await routingService.calculateTotalTime(req.params.id, quantity);
      return res.status(200).json({ status: 'success', data: result });
    } catch (error) {
      return next(error);
    }
  }
}

export default new RoutingController();
