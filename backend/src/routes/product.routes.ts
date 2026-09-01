import { Router } from 'express';
import productController from '../controllers/product.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { createProductSchema, updateProductSchema } from '../validators/product.validator';

const router = Router();
router.use(authMiddleware);

router.get('/', productController.getAll);
router.get('/:id', productController.getById);
router.post('/', validate(createProductSchema), productController.create);
router.put('/:id', validate(updateProductSchema), productController.update);
router.delete('/:id', productController.delete);
router.patch('/:id/toggle-active', productController.toggleActive);

export default router;
