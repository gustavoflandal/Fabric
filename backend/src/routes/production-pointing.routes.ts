import { Router } from 'express';
import productionPointingController from '../controllers/production-pointing.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  createProductionPointingSchema,
  updateProductionPointingSchema,
  finishPointingSchema,
} from '../validators/production-pointing.validator';

const router = Router();

router.use(authMiddleware);

router.get('/', productionPointingController.getAll);
router.get('/my-pointings', productionPointingController.getMyPointings);
router.get('/order/:orderId', productionPointingController.getByOrder);
router.get('/operator/:userId', productionPointingController.getByOperator);
router.get('/:id', productionPointingController.getById);
router.post('/', validate(createProductionPointingSchema), productionPointingController.create);
router.put('/:id', validate(updateProductionPointingSchema), productionPointingController.update);
router.patch('/:id/finish', validate(finishPointingSchema), productionPointingController.finish);
router.delete('/:id', productionPointingController.delete);

export default router;
