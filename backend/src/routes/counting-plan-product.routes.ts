import { Router } from 'express';
import countingPlanProductController from '../controllers/counting-plan-product.controller';
import { requirePermission } from '../middleware/permission.middleware';

const router = Router();

// Autenticação já aplicada pelo router pai (counting.routes.ts). Reaproveita
// 'planos_contagem' - associação de produto ao plano é parte da gestão do
// plano de contagem, sem recurso próprio seedado.

// Adicionar produto ao plano
router.post('/plans/:planId/products', requirePermission('planos_contagem', 'editar'), countingPlanProductController.addProduct);

// Remover produto do plano
router.delete('/plans/:planId/products/:productId', requirePermission('planos_contagem', 'editar'), countingPlanProductController.removeProduct);

// Listar produtos do plano
router.get('/plans/:planId/products', requirePermission('planos_contagem', 'visualizar'), countingPlanProductController.listProducts);

// Atualizar prioridade do produto
router.patch('/plans/:planId/products/:productId', requirePermission('planos_contagem', 'editar'), countingPlanProductController.updatePriority);

export default router;
