import { Router } from 'express';
import countingPlanProductController from '../controllers/counting-plan-product.controller';

const router = Router();

// Adicionar produto ao plano
router.post('/plans/:planId/products', countingPlanProductController.addProduct);

// Remover produto do plano
router.delete('/plans/:planId/products/:productId', countingPlanProductController.removeProduct);

// Listar produtos do plano
router.get('/plans/:planId/products', countingPlanProductController.listProducts);

// Atualizar prioridade do produto
router.patch('/plans/:planId/products/:productId', countingPlanProductController.updatePriority);

export default router;
