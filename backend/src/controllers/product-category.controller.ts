import { Request, Response, NextFunction } from 'express';
import productCategoryService from '../services/product-category.service';

export class ProductCategoryController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const category = await productCategoryService.create(req.body);
      return res.status(201).json({ status: 'success', data: category });
    } catch (error) {
      return next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 100;
      const filters = {
        search: req.query.search as string,
        parentId: req.query.parentId === 'null' ? null : (req.query.parentId as string | undefined),
      };

      const result = await productCategoryService.getAll(page, limit, filters);
      return res.status(200).json({ status: 'success', data: result.data, pagination: result.pagination });
    } catch (error) {
      return next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const category = await productCategoryService.getById(req.params.id);
      if (!category) {
        return res.status(404).json({ status: 'error', message: 'Categoria não encontrada' });
      }
      return res.status(200).json({ status: 'success', data: category });
    } catch (error) {
      return next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const category = await productCategoryService.update(req.params.id, req.body);
      return res.status(200).json({ status: 'success', data: category });
    } catch (error) {
      return next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await productCategoryService.delete(req.params.id);
      return res.status(204).send();
    } catch (error) {
      return next(error);
    }
  }
}

export default new ProductCategoryController();
