import { Router } from 'express';
import yardDockController from '../controllers/yard-dock.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate, validateQuery } from '../middleware/validation.middleware';
import {
  createYardDockSchema,
  listYardDockQuerySchema,
  updateYardDockSchema,
} from '../validators/yard-dock.validator';

const router = Router();
router.use(authMiddleware);

router.get(
  '/',
  requirePermission('yard', 'visualizar'),
  validateQuery(listYardDockQuerySchema),
  yardDockController.getAll
);
router.get('/:id', requirePermission('yard', 'visualizar'), yardDockController.getById);
router.post(
  '/',
  requirePermission('yard', 'gerenciar'),
  validate(createYardDockSchema),
  yardDockController.create
);
router.put(
  '/:id',
  requirePermission('yard', 'gerenciar'),
  validate(updateYardDockSchema),
  yardDockController.update
);
router.delete('/:id', requirePermission('yard', 'gerenciar'), yardDockController.delete);

export default router;
