import { Router } from 'express';
import yardVisitController from '../controllers/yard-visit.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate, validateQuery } from '../middleware/validation.middleware';
import {
  allocateSpotYardVisitSchema,
  checkInYardVisitSchema,
  createYardVisitSchema,
  listYardVisitQuerySchema,
  moveToDockYardVisitSchema,
  updateYardVisitSchema,
} from '../validators/yard-visit.validator';

const router = Router();
router.use(authMiddleware);

router.get(
  '/',
  requirePermission('yard', 'visualizar'),
  validateQuery(listYardVisitQuerySchema),
  yardVisitController.getAll
);
router.get('/:id', requirePermission('yard', 'visualizar'), yardVisitController.getById);
router.post(
  '/',
  requirePermission('yard', 'executar'),
  validate(createYardVisitSchema),
  yardVisitController.create
);
router.put(
  '/:id',
  requirePermission('yard', 'gerenciar'),
  validate(updateYardVisitSchema),
  yardVisitController.update
);
router.delete('/:id', requirePermission('yard', 'gerenciar'), yardVisitController.delete);
router.patch(
  '/:id/check-in',
  requirePermission('yard', 'executar'),
  validate(checkInYardVisitSchema),
  yardVisitController.checkIn
);
router.patch(
  '/:id/allocate-spot',
  requirePermission('yard', 'executar'),
  validate(allocateSpotYardVisitSchema),
  yardVisitController.allocateSpot
);
router.patch(
  '/:id/move-to-dock',
  requirePermission('yard', 'executar'),
  validate(moveToDockYardVisitSchema),
  yardVisitController.moveToDock
);
router.patch('/:id/start-loading', requirePermission('yard', 'executar'), yardVisitController.startLoading);
router.patch('/:id/end-loading', requirePermission('yard', 'executar'), yardVisitController.endLoading);
router.patch('/:id/complete', requirePermission('yard', 'executar'), yardVisitController.complete);
router.patch('/:id/cancel', requirePermission('yard', 'gerenciar'), yardVisitController.cancel);

export default router;
