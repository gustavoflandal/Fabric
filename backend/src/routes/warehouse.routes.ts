import { Router } from 'express';
import warehouseController from '../controllers/warehouse.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validation.middleware';
import { createWarehouseSchema, updateWarehouseSchema } from '../validators/warehouse.validator';

const router = Router();

router.use(authMiddleware);

router.get('/', requirePermission('armazens', 'visualizar'), warehouseController.getAll);
router.get('/:id', requirePermission('armazens', 'visualizar'), warehouseController.getById);
router.post('/', requirePermission('armazens', 'criar'), validate(createWarehouseSchema), warehouseController.create);
router.put('/:id', requirePermission('armazens', 'editar'), validate(updateWarehouseSchema), warehouseController.update);
router.delete('/:id', requirePermission('armazens', 'excluir'), warehouseController.delete);
router.patch('/:id/toggle-active', requirePermission('armazens', 'editar'), warehouseController.toggleActive);

export default router;