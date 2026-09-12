import { Router } from 'express';
import yardWarehouseParamsController from '../controllers/yard-warehouse-params.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validation.middleware';
import { upsertYardWarehouseParamsSchema } from '../validators/yard-warehouse-params.validator';

const router = Router();
router.use(authMiddleware);

router.get(
  '/:warehouseId',
  requirePermission('yard', 'visualizar'),
  yardWarehouseParamsController.getByWarehouseId
);
router.put(
  '/:warehouseId',
  requirePermission('yard', 'gerenciar'),
  validate(upsertYardWarehouseParamsSchema),
  yardWarehouseParamsController.upsert
);

export default router;
