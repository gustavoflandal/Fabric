import { Router } from 'express';
import stockController from '../controllers/stock.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/summary', requirePermission('stock', 'read'), stockController.getSummary);
router.get('/balances', requirePermission('stock', 'read'), stockController.getAllBalances);
router.get('/balance/:productId', requirePermission('stock', 'read'), stockController.getBalance);
router.get('/low-stock', requirePermission('stock', 'read'), stockController.getLowStock);
router.get('/excess-stock', requirePermission('stock', 'read'), stockController.getExcessStock);
router.get('/movements/:productId', requirePermission('stock', 'read'), stockController.getMovements);
router.post('/entry', requirePermission('stock', 'entry'), stockController.registerEntry);
router.post('/exit', requirePermission('stock', 'exit'), stockController.registerExit);
router.post(
  '/adjustment',
  requirePermission('stock', 'adjustment'),
  stockController.registerAdjustment
);
// Não há ação dedicada para reserva; usa a ação genérica de movimentação de estoque
router.post(
  '/reserve/:orderId',
  requirePermission('stock', 'update'),
  stockController.reserveForOrder
);

export default router;
