import { Router } from 'express';
import workCenterController from '../controllers/work-center.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
router.use(authMiddleware);

router.get('/', workCenterController.getAll);
router.get('/:id', workCenterController.getById);
router.post('/', workCenterController.create);
router.put('/:id', workCenterController.update);
router.delete('/:id', workCenterController.delete);
router.patch('/:id/toggle-active', workCenterController.toggleActive);

export default router;
