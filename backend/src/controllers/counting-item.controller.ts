import { Request, Response } from 'express';
import countingItemService from '../services/counting-item.service';

class CountingItemController {
  /**
   * GET /api/counting/items
   * Listar itens de contagem
   */
  async index(req: Request, res: Response) {
    try {
      const filters = {
        sessionId: req.query.sessionId as string,
        status: req.query.status as any,
        hasDifference: req.query.hasDifference === 'true' ? true : req.query.hasDifference === 'false' ? false : undefined,
        productId: req.query.productId as string,
      };

      const items = await countingItemService.findAll(filters);
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/counting/items/:id
   * Buscar item por ID
   */
  async show(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const item = await countingItemService.findById(id);

      if (!item) {
        return res.status(404).json({ error: 'Item não encontrado' });
      }

      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/counting/items/:id/count
   * Contar item
   */
  async count(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      const data = {
        countedQty: req.body.countedQty,
        notes: req.body.notes,
        countedBy: userId,
      };

      const item = await countingItemService.count(id, data);
      res.json(item);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * POST /api/counting/items/:id/recount
   * Recontar item
   */
  async recount(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      const data = {
        recountQty: req.body.recountQty,
        notes: req.body.notes,
        recountedBy: userId,
      };

      const item = await countingItemService.recount(id, data);
      res.json(item);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * POST /api/counting/items/:id/accept
   * Aceitar contagem sem recontagem
   */
  async accept(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const item = await countingItemService.accept(id, reason);
      res.json(item);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * POST /api/counting/items/:id/cancel
   * Cancelar contagem de item
   */
  async cancel(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const item = await countingItemService.cancel(id, reason);
      res.json(item);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * GET /api/counting/items/pending/me
   * Buscar itens pendentes do usuário logado
   */
  async getPendingByUser(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      const items = await countingItemService.findPendingByUser(userId);
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/counting/sessions/:sessionId/divergences
   * Buscar itens com divergência de uma sessão
   */
  async getDivergences(req: Request, res: Response) {
    try {
      const { sessionId } = req.params;
      const items = await countingItemService.findDivergencesBySession(sessionId);
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/counting/products/:productId/stats
   * Estatísticas de contagem de um produto
   */
  async getProductStats(req: Request, res: Response) {
    try {
      const { productId } = req.params;
      const stats = await countingItemService.getItemStats(productId);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

export default new CountingItemController();
