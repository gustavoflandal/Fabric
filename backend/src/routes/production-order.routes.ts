import { Router } from 'express';
import productionOrderController from '../controllers/production-order.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  createProductionOrderSchema,
  updateProductionOrderSchema,
  changeStatusSchema,
  updateProgressSchema,
} from '../validators/production-order.validator';

const router = Router();

router.use(authMiddleware);

router.get('/', productionOrderController.getAll);
router.get('/:id', productionOrderController.getById);
router.get('/:id/operations', productionOrderController.getOperations);
router.get('/:id/materials', productionOrderController.getMaterials);
router.post('/', validate(createProductionOrderSchema), productionOrderController.create);
router.post('/:id/calculate-materials', productionOrderController.calculateMaterials);
router.post('/:id/calculate-operations', productionOrderController.calculateOperations);
router.put('/:id', validate(updateProductionOrderSchema), productionOrderController.update);
router.patch('/:id/status', validate(changeStatusSchema), productionOrderController.changeStatus);
router.patch('/:id/progress', validate(updateProgressSchema), productionOrderController.updateProgress);
router.delete('/:id', productionOrderController.delete);

export default router;
