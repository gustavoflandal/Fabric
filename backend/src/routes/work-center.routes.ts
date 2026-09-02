import { Router } from 'express';
import workCenterController from '../controllers/work-center.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';

const router = Router();
router.use(authMiddleware);

router.get('/', requirePermission('work_centers', 'read'), workCenterController.getAll);
router.get('/:id', requirePermission('work_centers', 'read'), workCenterController.getById);
router.post('/', requirePermission('work_centers', 'create'), workCenterController.create);
router.put('/:id', requirePermission('work_centers', 'update'), workCenterController.update);
router.delete('/:id', requirePermission('work_centers', 'delete'), workCenterController.delete);
router.patch(
  '/:id/toggle-active',
  requirePermission('work_centers', 'update'),
  workCenterController.toggleActive
);

export default router;
