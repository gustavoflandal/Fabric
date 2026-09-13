import { Router } from 'express';
import yardSpotController from '../controllers/yard-spot.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate, validateQuery } from '../middleware/validation.middleware';
import {
  listYardSpotQuerySchema,
  setYardSpotBlockedSchema,
  updateYardSpotSchema,
} from '../validators/yard-spot.validator';

const router = Router();
router.use(authMiddleware);

router.get('/', requirePermission('yard', 'visualizar'), validateQuery(listYardSpotQuerySchema), yardSpotController.getAll);
router.get('/:id', requirePermission('yard', 'visualizar'), yardSpotController.getById);
router.put('/:id', requirePermission('yard', 'gerenciar'), validate(updateYardSpotSchema), yardSpotController.update);
router.delete('/:id', requirePermission('yard', 'gerenciar'), yardSpotController.delete);
router.patch(
  '/:id/blocked',
  requirePermission('yard', 'gerenciar'),
  validate(setYardSpotBlockedSchema),
  yardSpotController.setBlocked
);

export default router;
