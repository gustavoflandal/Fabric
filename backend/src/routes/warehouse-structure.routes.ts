import { Router } from 'express';
import warehouseStructureController from '../controllers/warehouse-structure.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validation.middleware';
import { createWarehouseStructureSchema, updateWarehouseStructureSchema } from '../validators/warehouse-structure.validator';

const router = Router();

router.use(authMiddleware);

router.get('/', requirePermission('estruturas_armazem', 'visualizar'), warehouseStructureController.getAll);
router.get('/:id', requirePermission('estruturas_armazem', 'visualizar'), warehouseStructureController.getById);
router.post('/', requirePermission('estruturas_armazem', 'criar'), validate(createWarehouseStructureSchema), warehouseStructureController.create);
router.put('/:id', requirePermission('estruturas_armazem', 'editar'), validate(updateWarehouseStructureSchema), warehouseStructureController.update);
router.delete('/:id', requirePermission('estruturas_armazem', 'excluir'), warehouseStructureController.delete);

export default router;
