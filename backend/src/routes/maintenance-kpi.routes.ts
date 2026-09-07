import { Router } from 'express';
import maintenanceKpiController from '../controllers/maintenance-kpi.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';

const router = Router();
router.use(authMiddleware);

router.get('/kpis', requirePermission('manutencao', 'visualizar'), maintenanceKpiController.getKpis);

export default router;
