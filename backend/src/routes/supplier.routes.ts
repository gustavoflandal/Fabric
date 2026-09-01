import { Router } from 'express';
import supplierController from '../controllers/supplier.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', requirePermission('suppliers', 'read'), supplierController.getAll);
router.get('/:id', requirePermission('suppliers', 'read'), supplierController.getById);
router.post('/', requirePermission('suppliers', 'create'), supplierController.create);
router.put('/:id', requirePermission('suppliers', 'update'), supplierController.update);
router.delete('/:id', requirePermission('suppliers', 'delete'), supplierController.delete);
router.patch('/:id/toggle-active', requirePermission('suppliers', 'update'), supplierController.toggleActive);

export default router;
