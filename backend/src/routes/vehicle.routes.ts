import { Router } from 'express';
import vehicleController from '../controllers/vehicle.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate, validateQuery } from '../middleware/validation.middleware';
import {
  createVehicleSchema,
  listVehicleQuerySchema,
  setVehicleBlockedSchema,
  updateVehicleSchema,
} from '../validators/vehicle.validator';

const router = Router();
router.use(authMiddleware);

router.get(
  '/',
  requirePermission('yard', 'visualizar'),
  validateQuery(listVehicleQuerySchema),
  vehicleController.getAll
);
router.get('/:id', requirePermission('yard', 'visualizar'), vehicleController.getById);
router.post(
  '/',
  requirePermission('yard', 'gerenciar'),
  validate(createVehicleSchema),
  vehicleController.create
);
router.put(
  '/:id',
  requirePermission('yard', 'gerenciar'),
  validate(updateVehicleSchema),
  vehicleController.update
);
router.delete('/:id', requirePermission('yard', 'gerenciar'), vehicleController.delete);
router.patch(
  '/:id/blocked',
  requirePermission('yard', 'gerenciar'),
  validate(setVehicleBlockedSchema),
  vehicleController.setBlocked
);

export default router;
