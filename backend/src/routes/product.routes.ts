import { Router } from 'express';
import productController from '../controllers/product.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validation.middleware';
import { createProductSchema, updateProductSchema } from '../validators/product.validator';

const router = Router();
router.use(authMiddleware);

router.get('/', requirePermission('products', 'read'), productController.getAll);
router.get('/:id', requirePermission('products', 'read'), productController.getById);
router.post('/', requirePermission('products', 'create'), validate(createProductSchema), productController.create);
router.put('/:id', requirePermission('products', 'update'), validate(updateProductSchema), productController.update);
router.delete('/:id', requirePermission('products', 'delete'), productController.delete);
router.patch('/:id/toggle-active', requirePermission('products', 'update'), productController.toggleActive);

export default router;
