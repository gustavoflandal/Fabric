import { Router } from 'express';
import routingController from '../controllers/routing.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validation.middleware';
import { createRoutingSchema, updateRoutingSchema, setActiveRoutingSchema } from '../validators/routing.validator';

const router = Router();

router.use(authMiddleware);

router.get('/', requirePermission('routings', 'read'), routingController.getAll);
router.get(
  '/product/:productId',
  requirePermission('routings', 'read'),
  routingController.getByProduct
);
router.get('/:id', requirePermission('routings', 'read'), routingController.getById);
router.get(
  '/:id/calculate-time',
  requirePermission('routings', 'read'),
  routingController.calculateTotalTime
);
router.post(
  '/',
  requirePermission('routings', 'create'),
  validate(createRoutingSchema),
  routingController.create
);
router.put(
  '/:id',
  requirePermission('routings', 'update'),
  validate(updateRoutingSchema),
  routingController.update
);
router.patch(
  '/:id/set-active',
  requirePermission('routings', 'update'),
  validate(setActiveRoutingSchema),
  routingController.setActive
);
router.delete('/:id', requirePermission('routings', 'delete'), routingController.delete);

export default router;
