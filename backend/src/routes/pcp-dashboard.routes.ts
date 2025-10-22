import { Router } from 'express';
import pcpDashboardController from '../controllers/pcp-dashboard.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

/**
 * @route   GET /api/v1/pcp/dashboard
 * @desc    Obtém todos os dados do dashboard
 * @access  Private
 */
router.get('/', pcpDashboardController.getAllDashboardData);

/**
 * @route   GET /api/v1/pcp/dashboard/kpis
 * @desc    Obtém apenas os KPIs do dashboard
 * @access  Private
 */
router.get('/kpis', pcpDashboardController.getKPIs);

/**
 * @route   GET /api/v1/pcp/dashboard/orders-by-status
 * @desc    Obtém contagem de ordens por status
 * @access  Private
 */
router.get('/orders-by-status', pcpDashboardController.getOrdersByStatus);

/**
 * @route   GET /api/v1/pcp/dashboard/daily-production
 * @desc    Obtém produção diária dos últimos N dias
 * @query   days - Número de dias (padrão: 7)
 * @access  Private
 */
router.get('/daily-production', pcpDashboardController.getDailyProduction);

/**
 * @route   GET /api/v1/pcp/dashboard/work-center-efficiency
 * @desc    Obtém eficiência por centro de trabalho
 * @access  Private
 */
router.get('/work-center-efficiency', pcpDashboardController.getWorkCenterEfficiency);

/**
 * @route   GET /api/v1/pcp/dashboard/top-products
 * @desc    Obtém top N produtos mais produzidos
 * @query   limit - Número de produtos (padrão: 5)
 * @access  Private
 */
router.get('/top-products', pcpDashboardController.getTopProducts);

/**
 * @route   GET /api/v1/pcp/dashboard/work-center-occupation
 * @desc    Obtém ocupação dos centros de trabalho
 * @access  Private
 */
router.get('/work-center-occupation', pcpDashboardController.getWorkCenterOccupation);

/**
 * @route   GET /api/v1/pcp/dashboard/time-distribution
 * @desc    Obtém distribuição de tempo (setup vs execução)
 * @query   days - Número de dias (padrão: 7)
 * @access  Private
 */
router.get('/time-distribution', pcpDashboardController.getTimeDistribution);

export default router;
