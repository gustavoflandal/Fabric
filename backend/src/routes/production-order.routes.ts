import { Router } from 'express';
import productionOrderController from '../controllers/production-order.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  createProductionOrderSchema,
  updateProductionOrderSchema,
  changeStatusSchema,
  updateProgressSchema,
} from '../validators/production-order.validator';

const router = Router();

router.use(authMiddleware);

router.get('/', requirePermission('production_orders', 'read'), productionOrderController.getAll);
router.get('/:id', requirePermission('production_orders', 'read'), productionOrderController.getById);
router.get('/:id/operations', requirePermission('production_orders', 'read'), productionOrderController.getOperations);
router.get('/:id/materials', requirePermission('production_orders', 'read'), productionOrderController.getMaterials);
router.post('/', requirePermission('production_orders', 'create'), validate(createProductionOrderSchema), productionOrderController.create);
router.post('/:id/calculate-materials', requirePermission('production_orders', 'execute'), productionOrderController.calculateMaterials);
router.post('/:id/calculate-operations', requirePermission('production_orders', 'execute'), productionOrderController.calculateOperations);
router.put('/:id', requirePermission('production_orders', 'update'), validate(updateProductionOrderSchema), productionOrderController.update);
router.patch('/:id/status', requirePermission('production_orders', 'update'), validate(changeStatusSchema), productionOrderController.changeStatus);
router.patch('/:id/progress', requirePermission('production_orders', 'update'), validate(updateProgressSchema), productionOrderController.updateProgress);
router.delete('/:id', requirePermission('production_orders', 'delete'), productionOrderController.delete);

export default router;
