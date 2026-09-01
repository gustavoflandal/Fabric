import { Router } from 'express';
import stockController from '../controllers/stock.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/summary', stockController.getSummary);
router.get('/balances', stockController.getAllBalances);
router.get('/balance/:productId', stockController.getBalance);
router.get('/low-stock', stockController.getLowStock);
router.get('/excess-stock', stockController.getExcessStock);
router.get('/movements/:productId', stockController.getMovements);
router.post('/entry', stockController.registerEntry);
router.post('/exit', stockController.registerExit);
router.post('/adjustment', stockController.registerAdjustment);
router.post('/reserve/:orderId', stockController.reserveForOrder);

export default router;
