import { Router } from 'express';
import customerController from '../controllers/customer.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
router.use(authMiddleware);

router.get('/', customerController.getAll);
router.get('/:id', customerController.getById);
router.post('/', customerController.create);
router.put('/:id', customerController.update);
router.delete('/:id', customerController.delete);
router.patch('/:id/toggle-active', customerController.toggleActive);

export default router;
