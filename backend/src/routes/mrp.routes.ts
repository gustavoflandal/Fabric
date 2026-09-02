import { Router } from 'express';
import mrpController from '../controllers/mrp.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/summary', requirePermission('mrp', 'read'), mrpController.getSummary);
// Apesar do verbo GET, esta rota dispara a execução do MRP para a ordem
router.get('/order/:orderId', requirePermission('mrp', 'execute'), mrpController.executeForOrder);
router.post(
  '/execute-multiple',
  requirePermission('mrp', 'execute'),
  mrpController.executeForMultipleOrders
);
router.post(
  '/execute-all',
  requirePermission('mrp', 'execute'),
  mrpController.executeForAllPending
);
router.post(
  '/consolidate',
  requirePermission('mrp', 'consolidate'),
  mrpController.consolidateRequirements
);
router.get(
  '/purchase-suggestions',
  requirePermission('mrp', 'read'),
  mrpController.generatePurchaseSuggestions
);
router.get(
  '/production-suggestions',
  requirePermission('mrp', 'read'),
  mrpController.generateProductionSuggestions
);

export default router;
