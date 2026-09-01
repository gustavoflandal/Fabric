import { Router } from 'express';
import dashboardController from '../controllers/dashboard.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/statistics', requirePermission('dashboard', 'read'), dashboardController.getStatistics);
router.get('/production-metrics', requirePermission('dashboard', 'read'), dashboardController.getProductionMetrics);
router.get('/work-center-metrics', requirePermission('dashboard', 'read'), dashboardController.getWorkCenterMetrics);
router.get('/top-products', requirePermission('dashboard', 'read'), dashboardController.getTopProducts);
router.get('/recent-activity', requirePermission('dashboard', 'read'), dashboardController.getRecentActivity);
router.get('/production-trend', requirePermission('dashboard', 'read'), dashboardController.getProductionTrend);

export default router;
