import { Router } from 'express';
import maintenanceOrderController from '../controllers/maintenance-order.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate, validateQuery } from '../middleware/validation.middleware';
import {
  cancelMaintenanceOrderSchema,
  completeMaintenanceOrderSchema,
  createMaintenanceOrderSchema,
  listMaintenanceOrderQuerySchema,
  updateMaintenanceOrderSchema,
} from '../validators/maintenance-order.validator';

const router = Router();
router.use(authMiddleware);

router.get(
  '/',
  requirePermission('manutencao', 'visualizar'),
  validateQuery(listMaintenanceOrderQuerySchema),
  maintenanceOrderController.getAll
);
router.get('/:id', requirePermission('manutencao', 'visualizar'), maintenanceOrderController.getById);
router.post(
  '/',
  requirePermission('manutencao', 'executar'),
  validate(createMaintenanceOrderSchema),
  maintenanceOrderController.create
);
router.put(
  '/:id',
  requirePermission('manutencao', 'gerenciar'),
  validate(updateMaintenanceOrderSchema),
  maintenanceOrderController.update
);
router.patch('/:id/start', requirePermission('manutencao', 'executar'), maintenanceOrderController.start);
router.patch(
  '/:id/complete',
  requirePermission('manutencao', 'executar'),
  validate(completeMaintenanceOrderSchema),
  maintenanceOrderController.complete
);
router.patch(
  '/:id/cancel',
  requirePermission('manutencao', 'gerenciar'),
  validate(cancelMaintenanceOrderSchema),
  maintenanceOrderController.cancel
);

export default router;
