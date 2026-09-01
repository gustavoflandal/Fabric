import { Router } from 'express';
import bomController from '../controllers/bom.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { createBomSchema, updateBomSchema, setActiveBomSchema } from '../validators/bom.validator';

const router = Router();

router.use(authMiddleware);

router.get('/', bomController.list);
router.get('/product/:productId/active', bomController.getActiveByProduct);
router.get('/:id', bomController.getById);
router.get('/:id/explode', bomController.explode);
router.post('/', validate(createBomSchema), bomController.create);
router.put('/:id', validate(updateBomSchema), bomController.update);
router.patch('/:id/active', validate(setActiveBomSchema), bomController.setActive);
router.delete('/:id', bomController.delete);

export default router;
