import { Router } from 'express';
import maintenancePlanController from '../controllers/maintenance-plan.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate, validateQuery } from '../middleware/validation.middleware';
import {
  createMaintenancePlanSchema,
  listMaintenancePlanQuerySchema,
  updateMaintenancePlanSchema,
} from '../validators/maintenance-plan.validator';

const router = Router();
router.use(authMiddleware);

router.get(
  '/',
  requirePermission('manutencao', 'visualizar'),
  validateQuery(listMaintenancePlanQuerySchema),
  maintenancePlanController.getAll
);
router.get('/:id', requirePermission('manutencao', 'visualizar'), maintenancePlanController.getById);
router.post(
  '/',
  requirePermission('manutencao', 'gerenciar'),
  validate(createMaintenancePlanSchema),
  maintenancePlanController.create
);
router.put(
  '/:id',
  requirePermission('manutencao', 'gerenciar'),
  validate(updateMaintenancePlanSchema),
  maintenancePlanController.update
);
router.delete('/:id', requirePermission('manutencao', 'gerenciar'), maintenancePlanController.delete);
router.patch(
  '/:id/toggle-active',
  requirePermission('manutencao', 'gerenciar'),
  maintenancePlanController.toggleActive
);

export default router;
