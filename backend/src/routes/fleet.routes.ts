import { Router } from 'express';
import fleetController from '../controllers/fleet.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate, validateQuery } from '../middleware/validation.middleware';
import {
  createFleetSchema,
  listFleetQuerySchema,
  setFleetBlockedSchema,
  updateFleetSchema,
} from '../validators/fleet.validator';

const router = Router();
router.use(authMiddleware);

router.get(
  '/',
  requirePermission('yard', 'visualizar'),
  validateQuery(listFleetQuerySchema),
  fleetController.getAll
);
router.get('/:id', requirePermission('yard', 'visualizar'), fleetController.getById);
router.post(
  '/',
  requirePermission('yard', 'gerenciar'),
  validate(createFleetSchema),
  fleetController.create
);
router.put(
  '/:id',
  requirePermission('yard', 'gerenciar'),
  validate(updateFleetSchema),
  fleetController.update
);
router.delete('/:id', requirePermission('yard', 'gerenciar'), fleetController.delete);
router.patch(
  '/:id/blocked',
  requirePermission('yard', 'gerenciar'),
  validate(setFleetBlockedSchema),
  fleetController.setBlocked
);

export default router;
