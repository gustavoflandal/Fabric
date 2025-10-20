import { Router } from 'express';
import productCategoryController from '../controllers/product-category.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { createProductCategorySchema, updateProductCategorySchema } from '../validators/product-category.validator';

const router = Router();

router.use(authMiddleware);

router.get('/', productCategoryController.getAll);
router.get('/:id', productCategoryController.getById);
router.post('/', validate(createProductCategorySchema), productCategoryController.create);
router.put('/:id', validate(updateProductCategorySchema), productCategoryController.update);
router.delete('/:id', productCategoryController.delete);

export default router;
