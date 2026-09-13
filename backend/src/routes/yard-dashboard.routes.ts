import { Router } from 'express';
import yardDashboardController from '../controllers/yard-dashboard.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validateQuery } from '../middleware/validation.middleware';
import { getYardDashboardQuerySchema } from '../validators/yard-dashboard.validator';

const router = Router();
router.use(authMiddleware);

router.get(
  '/',
  requirePermission('yard', 'visualizar'),
  validateQuery(getYardDashboardQuerySchema),
  yardDashboardController.getDashboard
);

export default router;
