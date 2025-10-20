import { Request, Response, NextFunction } from 'express';
import productService from '../services/product.service';

export class ProductController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const product = await productService.create(req.body);
      return res.status(201).json({ status: 'success', data: product, message: 'Produto criado com sucesso' });
    } catch (error) {
      return next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 100;
      const filters = {
        type: req.query.type as string,
        categoryId: req.query.categoryId as string,
        active: req.query.active === 'true' ? true : req.query.active === 'false' ? false : undefined,
        search: req.query.search as string,
      };
      const result = await productService.getAll(page, limit, filters);
      return res.status(200).json({ status: 'success', data: result.data, pagination: result.pagination });
    } catch (error) {
      return next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const product = await productService.getById(req.params.id);
      if (!product) {
        return res.status(404).json({ status: 'error', message: 'Produto não encontrado' });
      }
      return res.status(200).json({ status: 'success', data: product });
    } catch (error) {
      return next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const product = await productService.update(req.params.id, req.body);
      return res.status(200).json({ status: 'success', data: product, message: 'Produto atualizado com sucesso' });
    } catch (error) {
      return next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await productService.delete(req.params.id);
      return res.status(204).send();
    } catch (error) {
      return next(error);
    }
  }

  async toggleActive(req: Request, res: Response, next: NextFunction) {
    try {
      const product = await productService.toggleActive(req.params.id);
      return res.status(200).json({ status: 'success', data: product });
    } catch (error) {
      return next(error);
    }
  }
}

export default new ProductController();
