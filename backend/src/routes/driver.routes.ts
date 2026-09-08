import { Router } from 'express';
import driverController from '../controllers/driver.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate, validateQuery } from '../middleware/validation.middleware';
import {
  createDriverSchema,
  listDriverQuerySchema,
  setDriverBlockedSchema,
  updateDriverSchema,
} from '../validators/driver.validator';

const router = Router();
router.use(authMiddleware);

router.get(
  '/',
  requirePermission('yard', 'visualizar'),
  validateQuery(listDriverQuerySchema),
  driverController.getAll
);
router.get('/:id', requirePermission('yard', 'visualizar'), driverController.getById);
router.post(
  '/',
  requirePermission('yard', 'gerenciar'),
  validate(createDriverSchema),
  driverController.create
);
router.put(
  '/:id',
  requirePermission('yard', 'gerenciar'),
  validate(updateDriverSchema),
  driverController.update
);
router.delete('/:id', requirePermission('yard', 'gerenciar'), driverController.delete);
router.patch(
  '/:id/blocked',
  requirePermission('yard', 'gerenciar'),
  validate(setDriverBlockedSchema),
  driverController.setBlocked
);

export default router;
