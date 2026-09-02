import { Router } from 'express';
import countingPlanProductController from '../controllers/counting-plan-product.controller';
import { requirePermission } from '../middleware/permission.middleware';
// ✅ F0.7: validators do módulo de contagem.
import { validate } from '../middleware/validation.middleware';
import {
  addCountingPlanProductSchema,
  updateCountingPlanProductSchema,
} from '../validators/counting.validator';

const router = Router();

// Autenticação já aplicada pelo router pai (counting.routes.ts). Reaproveita
// 'planos_contagem' - associação de produto ao plano é parte da gestão do
// plano de contagem, sem recurso próprio seedado.

// Adicionar produto ao plano
router.post('/plans/:planId/products', requirePermission('planos_contagem', 'editar'), validate(addCountingPlanProductSchema), countingPlanProductController.addProduct);

// Remover produto do plano
router.delete('/plans/:planId/products/:productId', requirePermission('planos_contagem', 'editar'), countingPlanProductController.removeProduct);

// Listar produtos do plano
router.get('/plans/:planId/products', requirePermission('planos_contagem', 'visualizar'), countingPlanProductController.listProducts);

// Atualizar prioridade do produto
router.patch('/plans/:planId/products/:productId', requirePermission('planos_contagem', 'editar'), validate(updateCountingPlanProductSchema), countingPlanProductController.updatePriority);

export default router;
