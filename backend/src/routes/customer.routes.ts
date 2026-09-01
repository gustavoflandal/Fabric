import { Router } from 'express';
import customerController from '../controllers/customer.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';

const router = Router();
router.use(authMiddleware);

router.get('/', requirePermission('customers', 'read'), customerController.getAll);
router.get('/:id', requirePermission('customers', 'read'), customerController.getById);
router.post('/', requirePermission('customers', 'create'), customerController.create);
router.put('/:id', requirePermission('customers', 'update'), customerController.update);
router.delete('/:id', requirePermission('customers', 'delete'), customerController.delete);
router.patch('/:id/toggle-active', requirePermission('customers', 'update'), customerController.toggleActive);

export default router;
