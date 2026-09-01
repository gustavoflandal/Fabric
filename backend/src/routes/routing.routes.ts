import { Router } from 'express';
import routingController from '../controllers/routing.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { createRoutingSchema, updateRoutingSchema, setActiveRoutingSchema } from '../validators/routing.validator';

const router = Router();

router.use(authMiddleware);

router.get('/', routingController.getAll);
router.get('/product/:productId', routingController.getByProduct);
router.get('/:id', routingController.getById);
router.get('/:id/calculate-time', routingController.calculateTotalTime);
router.post('/', validate(createRoutingSchema), routingController.create);
router.put('/:id', validate(updateRoutingSchema), routingController.update);
router.patch('/:id/set-active', validate(setActiveRoutingSchema), routingController.setActive);
router.delete('/:id', routingController.delete);

export default router;
