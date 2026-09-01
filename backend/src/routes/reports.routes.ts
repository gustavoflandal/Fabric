import { Router } from 'express';
import reportsController from '../controllers/reports.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/production', requirePermission('reports', 'production'), reportsController.getProductionReport);
router.get('/efficiency', requirePermission('reports', 'efficiency'), reportsController.getEfficiencyReport);
router.get('/quality', requirePermission('reports', 'quality'), reportsController.getQualityReport);
router.get('/work-centers', requirePermission('reports', 'read'), reportsController.getWorkCenterReport);
router.get('/consolidated', requirePermission('reports', 'read'), reportsController.getConsolidatedReport);

export default router;
