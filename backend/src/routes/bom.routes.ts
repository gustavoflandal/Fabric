import { Router } from 'express';
import bomController from '../controllers/bom.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validation.middleware';
import { createBomSchema, updateBomSchema, setActiveBomSchema } from '../validators/bom.validator';

const router = Router();

router.use(authMiddleware);

router.get('/', requirePermission('boms', 'read'), bomController.list);
router.get('/product/:productId/active', requirePermission('boms', 'read'), bomController.getActiveByProduct);
router.get('/:id', requirePermission('boms', 'read'), bomController.getById);
router.get('/:id/explode', requirePermission('boms', 'read'), bomController.explode);
router.post('/', requirePermission('boms', 'create'), validate(createBomSchema), bomController.create);
router.put('/:id', requirePermission('boms', 'update'), validate(updateBomSchema), bomController.update);
router.patch('/:id/active', requirePermission('boms', 'update'), validate(setActiveBomSchema), bomController.setActive);
router.delete('/:id', requirePermission('boms', 'delete'), bomController.delete);

export default router;
