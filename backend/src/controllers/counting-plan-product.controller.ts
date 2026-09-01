import { Request, Response } from 'express';
import countingPlanProductService from '../services/counting-plan-product.service';

class CountingPlanProductController {
  /**
   * POST /api/counting/plans/:planId/products
   * Adicionar produto ao plano
   */
  async addProduct(req: Request, res: Response) {
    try {
      const { planId } = req.params;
      const data = {
        planId,
        productId: req.body.productId,
        priority: req.body.priority || 0
      };
      
      const result = await countingPlanProductService.addProduct(data);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * DELETE /api/counting/plans/:planId/products/:productId
   * Remover produto do plano
   */
  async removeProduct(req: Request, res: Response) {
    try {
      const { planId, productId } = req.params;
      await countingPlanProductService.removeProduct(planId, productId);
      res.status(204).send();
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * GET /api/counting/plans/:planId/products
   * Listar produtos do plano
   */
  async listProducts(req: Request, res: Response) {
    try {
      const { planId } = req.params;
      const products = await countingPlanProductService.listProducts(planId);
      res.json(products);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * PATCH /api/counting/plans/:planId/products/:productId
   * Atualizar prioridade do produto no plano
   */
  async updatePriority(req: Request, res: Response) {
    try {
      const { planId, productId } = req.params;
      const result = await countingPlanProductService.updatePriority(
        planId, 
        productId, 
        { priority: req.body.priority }
      );
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
}

export default new CountingPlanProductController();
