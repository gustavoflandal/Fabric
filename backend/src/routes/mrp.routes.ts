import { Router } from 'express';
import mrpController from '../controllers/mrp.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/summary', mrpController.getSummary);
router.get('/order/:orderId', mrpController.executeForOrder);
router.post('/execute-multiple', mrpController.executeForMultipleOrders);
router.post('/execute-all', mrpController.executeForAllPending);
router.post('/consolidate', mrpController.consolidateRequirements);
router.get('/purchase-suggestions', mrpController.getPurchaseSuggestions);
router.get('/production-suggestions', mrpController.getProductionSuggestions);

export default router;
