import { Router } from 'express';
import yardAreaController from '../controllers/yard-area.controller';
import yardSpotController from '../controllers/yard-spot.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate, validateQuery } from '../middleware/validation.middleware';
import {
  createYardAreaSchema,
  listYardAreaQuerySchema,
  setYardAreaBlockedSchema,
  updateYardAreaSchema,
} from '../validators/yard-area.validator';
import { generateYardSpotsSchema } from '../validators/yard-spot.validator';

const router = Router();
router.use(authMiddleware);

router.get('/', requirePermission('yard', 'visualizar'), validateQuery(listYardAreaQuerySchema), yardAreaController.getAll);
router.get('/:id', requirePermission('yard', 'visualizar'), yardAreaController.getById);
router.post('/', requirePermission('yard', 'gerenciar'), validate(createYardAreaSchema), yardAreaController.create);
router.put('/:id', requirePermission('yard', 'gerenciar'), validate(updateYardAreaSchema), yardAreaController.update);
router.delete('/:id', requirePermission('yard', 'gerenciar'), yardAreaController.delete);
router.patch(
  '/:id/blocked',
  requirePermission('yard', 'gerenciar'),
  validate(setYardAreaBlockedSchema),
  yardAreaController.setBlocked
);

router.post(
  '/:areaId/spots/generate',
  requirePermission('yard', 'gerenciar'),
  validate(generateYardSpotsSchema),
  yardSpotController.generateBatch
);

export default router;
