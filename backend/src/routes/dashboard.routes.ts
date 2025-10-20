import { Router } from 'express';
import dashboardController from '../controllers/dashboard.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/statistics', dashboardController.getStatistics);
router.get('/production-metrics', dashboardController.getProductionMetrics);
router.get('/work-center-metrics', dashboardController.getWorkCenterMetrics);
router.get('/top-products', dashboardController.getTopProducts);
router.get('/recent-activity', dashboardController.getRecentActivity);
router.get('/production-trend', dashboardController.getProductionTrend);

export default router;
