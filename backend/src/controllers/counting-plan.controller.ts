import { Request, Response, NextFunction } from 'express';
import countingPlanService from '../services/counting-plan.service';

class CountingPlanController {
  /**
   * GET /api/counting/plans
   * Listar todos os planos de contagem
   */
  async index(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = {
        status: req.query.status as any,
        type: req.query.type as any,
        frequency: req.query.frequency as any,
        search: req.query.search as string,
      };

      const plans = await countingPlanService.findAll(filters);
      res.json(plans);
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * GET /api/counting/plans/:id
   * Buscar plano por ID
   */
  async show(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const plan = await countingPlanService.findById(id);

      if (!plan) {
        return res.status(404).json({ error: 'Plano não encontrado' });
      }

      res.json(plan);
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * POST /api/counting/plans
   * Criar novo plano
   */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      const data = {
        ...req.body,
        createdBy: userId,
      };

      const plan = await countingPlanService.create(data);
      res.status(201).json(plan);
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * PUT /api/counting/plans/:id
   * Atualizar plano
   */
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      console.log('Corpo da requisição:', req.body);
      const plan = await countingPlanService.update(id, req.body);
      res.json(plan);
    } catch (error: any) {
      console.error('Erro ao atualizar plano:', error);
      next(error);
    }
  }

  /**
   * DELETE /api/counting/plans/:id
   * Deletar plano
   */
  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await countingPlanService.delete(id);
      res.status(204).send();
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * PATCH /api/counting/plans/:id/activate
   * Ativar plano
   */
  async activate(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const plan = await countingPlanService.activate(id);
      res.json(plan);
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * PATCH /api/counting/plans/:id/pause
   * Pausar plano
   */
  async pause(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const plan = await countingPlanService.pause(id);
      res.json(plan);
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * PATCH /api/counting/plans/:id/cancel
   * Cancelar plano
   */
  async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const plan = await countingPlanService.cancel(id);
      res.json(plan);
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * GET /api/counting/plans/:id/products
   * Visualizar produtos selecionados pelo plano
   */
  async getProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const products = await countingPlanService.selectProducts(id);
      res.json(products);
    } catch (error: any) {
      next(error);
    }
  }
}

export default new CountingPlanController();
