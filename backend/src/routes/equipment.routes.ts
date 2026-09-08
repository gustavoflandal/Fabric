import { Router } from 'express';
import equipmentController from '../controllers/equipment.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate, validateQuery } from '../middleware/validation.middleware';
import {
  createEquipmentSchema,
  listEquipmentQuerySchema,
  updateEquipmentSchema,
} from '../validators/equipment.validator';

const router = Router();
router.use(authMiddleware);

router.get(
  '/',
  requirePermission('manutencao', 'visualizar'),
  validateQuery(listEquipmentQuerySchema),
  equipmentController.getAll
);
router.get('/:id', requirePermission('manutencao', 'visualizar'), equipmentController.getById);
router.post(
  '/',
  requirePermission('manutencao', 'gerenciar'),
  validate(createEquipmentSchema),
  equipmentController.create
);
router.put(
  '/:id',
  requirePermission('manutencao', 'gerenciar'),
  validate(updateEquipmentSchema),
  equipmentController.update
);
router.delete('/:id', requirePermission('manutencao', 'gerenciar'), equipmentController.delete);
router.patch(
  '/:id/toggle-active',
  requirePermission('manutencao', 'gerenciar'),
  equipmentController.toggleActive
);

export default router;
