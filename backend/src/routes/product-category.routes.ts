import { Router } from 'express';
import productCategoryController from '../controllers/product-category.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validation.middleware';
import { createProductCategorySchema, updateProductCategorySchema } from '../validators/product-category.validator';

const router = Router();

router.use(authMiddleware);

// Reaproveita o recurso 'products' (categorias são um sub-cadastro de produtos,
// sem recurso próprio seedado - ver Fase 2 do cronograma).
router.get('/', requirePermission('products', 'read'), productCategoryController.getAll);
router.get('/:id', requirePermission('products', 'read'), productCategoryController.getById);
router.post('/', requirePermission('products', 'create'), validate(createProductCategorySchema), productCategoryController.create);
router.put('/:id', requirePermission('products', 'update'), validate(updateProductCategorySchema), productCategoryController.update);
router.delete('/:id', requirePermission('products', 'delete'), productCategoryController.delete);

export default router;
