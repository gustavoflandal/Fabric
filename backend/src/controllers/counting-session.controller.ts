import { Request, Response } from 'express';
import countingSessionService from '../services/counting-session.service';

class CountingSessionController {
  /**
   * GET /api/counting/sessions
   * Listar todas as sessões
   */
  async index(req: Request, res: Response) {
    try {
      const filters = {
        status: req.query.status as any,
        planId: req.query.planId as string,
        assignedTo: req.query.assignedTo as string,
        dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
        dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined,
      };

      const sessions = await countingSessionService.findAll(filters);
      res.json(sessions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/counting/sessions/:id
   * Buscar sessão por ID
   */
  async show(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const session = await countingSessionService.findById(id);

      if (!session) {
        return res.status(404).json({ error: 'Sessão não encontrada' });
      }

      res.json(session);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/counting/sessions
   * Criar nova sessão
   */
  async create(req: Request, res: Response) {
    try {
      const session = await countingSessionService.create(req.body);
      res.status(201).json(session);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * POST /api/counting/sessions/:id/start
   * Iniciar sessão
   */
  async start(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      const session = await countingSessionService.start(id, userId);
      res.json(session);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * POST /api/counting/sessions/:id/complete
   * Completar sessão
   */
  async complete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      const session = await countingSessionService.complete(id, userId);
      res.json(session);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * POST /api/counting/sessions/:id/cancel
   * Cancelar sessão
   */
  async cancel(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const session = await countingSessionService.cancel(id);
      res.json(session);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * GET /api/counting/sessions/:id/report
   * Gerar relatório de divergências
   */
  async getReport(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const report = await countingSessionService.generateReport(id);
      res.json(report);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * POST /api/counting/sessions/:id/adjust-stock
   * Ajustar estoque baseado na sessão
   */
  async adjustStock(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      const result = await countingSessionService.adjustStock(id, userId);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * GET /api/counting/dashboard
   * Dashboard de contagens
   */
  async getDashboard(req: Request, res: Response) {
    try {
      const dashboard = await countingSessionService.getDashboard();
      res.json(dashboard);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

export default new CountingSessionController();
