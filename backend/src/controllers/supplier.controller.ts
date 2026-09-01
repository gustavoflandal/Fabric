import { Request, Response, NextFunction } from 'express';
import supplierService from '../services/supplier.service';

export class SupplierController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const supplier = await supplierService.create(req.body);
      res.status(201).json({ status: 'success', data: supplier });
    } catch (error) {
      next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 100;
      const filters = {
        active: req.query.active === 'true' ? true : req.query.active === 'false' ? false : undefined,
        search: req.query.search as string,
      };

      const result = await supplierService.getAll(page, limit, filters);
      res.status(200).json({ status: 'success', data: result.data, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const supplier = await supplierService.getById(req.params.id);
      if (!supplier) {
        return res.status(404).json({ status: 'error', message: 'Fornecedor não encontrado' });
      }
      res.status(200).json({ status: 'success', data: supplier });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const supplier = await supplierService.update(req.params.id, req.body);
      res.status(200).json({ status: 'success', data: supplier });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await supplierService.delete(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  async toggleActive(req: Request, res: Response, next: NextFunction) {
    try {
      const supplier = await supplierService.toggleActive(req.params.id);
      res.status(200).json({ status: 'success', data: supplier });
    } catch (error) {
      next(error);
    }
  }
}

export default new SupplierController();
