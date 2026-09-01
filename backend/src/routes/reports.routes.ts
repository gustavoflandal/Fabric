import { Router } from 'express';
import reportsController from '../controllers/reports.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/production', reportsController.getProductionReport);
router.get('/efficiency', reportsController.getEfficiencyReport);
router.get('/quality', reportsController.getQualityReport);
router.get('/work-centers', reportsController.getWorkCenterReport);
router.get('/consolidated', reportsController.getConsolidatedReport);

export default router;
