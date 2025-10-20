import { Router } from 'express';
import supplierController from '../controllers/supplier.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', supplierController.getAll);
router.get('/:id', supplierController.getById);
router.post('/', supplierController.create);
router.put('/:id', supplierController.update);
router.delete('/:id', supplierController.delete);
router.patch('/:id/toggle-active', supplierController.toggleActive);

export default router;
