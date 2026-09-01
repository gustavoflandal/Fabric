import { Request, Response } from 'express';
import pcpDashboardService from '../services/pcp-dashboard.service';

class PCPDashboardController {
  /**
   * GET /api/v1/pcp/dashboard
   * Obtém todos os dados do dashboard
   */
  async getAllDashboardData(req: Request, res: Response) {
    try {
      const data = await pcpDashboardService.getAllDashboardData();
      res.json(data);
    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);
      res.status(500).json({ 
        message: 'Erro ao buscar dados do dashboard',
        error: error.message 
      });
    }
  }

  /**
   * GET /api/v1/pcp/dashboard/kpis
   * Obtém apenas os KPIs
   */
  async getKPIs(req: Request, res: Response) {
    try {
      const kpis = await pcpDashboardService.getKPIs();
      res.json(kpis);
    } catch (error: any) {
      console.error('Error fetching KPIs:', error);
      res.status(500).json({ 
        message: 'Erro ao buscar KPIs',
        error: error.message 
      });
    }
  }

  /**
   * GET /api/v1/pcp/dashboard/orders-by-status
   * Obtém contagem de ordens por status
   */
  async getOrdersByStatus(req: Request, res: Response) {
    try {
      const data = await pcpDashboardService.getOrdersByStatus();
      res.json(data);
    } catch (error: any) {
      console.error('Error fetching orders by status:', error);
      res.status(500).json({ 
        message: 'Erro ao buscar ordens por status',
        error: error.message 
      });
    }
  }

  /**
   * GET /api/v1/pcp/dashboard/daily-production?days=7
   * Obtém produção diária
   */
  async getDailyProduction(req: Request, res: Response) {
    try {
      const days = parseInt(req.query.days as string) || 7;
      const data = await pcpDashboardService.getDailyProduction(days);
      res.json(data);
    } catch (error: any) {
      console.error('Error fetching daily production:', error);
      res.status(500).json({ 
        message: 'Erro ao buscar produção diária',
        error: error.message 
      });
    }
  }

  /**
   * GET /api/v1/pcp/dashboard/work-center-efficiency
   * Obtém eficiência dos centros de trabalho
   */
  async getWorkCenterEfficiency(req: Request, res: Response) {
    try {
      const data = await pcpDashboardService.getWorkCenterEfficiency();
      res.json(data);
    } catch (error: any) {
      console.error('Error fetching work center efficiency:', error);
      res.status(500).json({ 
        message: 'Erro ao buscar eficiência dos centros',
        error: error.message 
      });
    }
  }

  /**
   * GET /api/v1/pcp/dashboard/top-products?limit=5
   * Obtém top produtos
   */
  async getTopProducts(req: Request, res: Response) {
    try {
      const limit = parseInt(req.query.limit as string) || 5;
      const data = await pcpDashboardService.getTopProducts(limit);
      res.json(data);
    } catch (error: any) {
      console.error('Error fetching top products:', error);
      res.status(500).json({ 
        message: 'Erro ao buscar top produtos',
        error: error.message 
      });
    }
  }

  /**
   * GET /api/v1/pcp/dashboard/work-center-occupation
   * Obtém ocupação dos centros de trabalho
   */
  async getWorkCenterOccupation(req: Request, res: Response) {
    try {
      const data = await pcpDashboardService.getWorkCenterOccupation();
      res.json(data);
    } catch (error: any) {
      console.error('Error fetching work center occupation:', error);
      res.status(500).json({ 
        message: 'Erro ao buscar ocupação dos centros',
        error: error.message 
      });
    }
  }

  /**
   * GET /api/v1/pcp/dashboard/time-distribution?days=7
   * Obtém distribuição de tempo (setup vs execução)
   */
  async getTimeDistribution(req: Request, res: Response) {
    try {
      const days = parseInt(req.query.days as string) || 7;
      const data = await pcpDashboardService.getTimeDistribution(days);
      res.json(data);
    } catch (error: any) {
      console.error('Error fetching time distribution:', error);
      res.status(500).json({ 
        message: 'Erro ao buscar distribuição de tempo',
        error: error.message 
      });
    }
  }
}

export default new PCPDashboardController();
