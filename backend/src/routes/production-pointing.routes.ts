import { Router } from 'express';
import productionPointingController from '../controllers/production-pointing.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  createProductionPointingSchema,
  updateProductionPointingSchema,
  finishPointingSchema,
} from '../validators/production-pointing.validator';

const router = Router();

router.use(authMiddleware);

router.get(
  '/',
  requirePermission('production_pointings', 'read'),
  productionPointingController.getAll
);
router.get(
  '/my-pointings',
  requirePermission('production_pointings', 'read'),
  productionPointingController.getMyPointings
);
router.get(
  '/order/:orderId',
  requirePermission('production_pointings', 'read'),
  productionPointingController.getByOrder
);
router.get(
  '/operator/:userId',
  requirePermission('production_pointings', 'read'),
  productionPointingController.getByOperator
);
router.get(
  '/:id',
  requirePermission('production_pointings', 'read'),
  productionPointingController.getById
);
router.post(
  '/',
  requirePermission('production_pointings', 'create'),
  validate(createProductionPointingSchema),
  productionPointingController.create
);
router.put(
  '/:id',
  requirePermission('production_pointings', 'update'),
  validate(updateProductionPointingSchema),
  productionPointingController.update
);
router.patch(
  '/:id/finish',
  requirePermission('production_pointings', 'update'),
  validate(finishPointingSchema),
  productionPointingController.finish
);
router.delete(
  '/:id',
  requirePermission('production_pointings', 'delete'),
  productionPointingController.delete
);

export default router;
