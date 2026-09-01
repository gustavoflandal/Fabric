import { Router } from 'express';
import purchaseReceiptController from '../controllers/purchase-receipt.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// Listar recebimentos
router.get(
  '/',
  requirePermission('recebimentos_compra', 'visualizar'),
  purchaseReceiptController.getAll
);

// Buscar recebimento por ID
router.get(
  '/:id',
  requirePermission('recebimentos_compra', 'visualizar'),
  purchaseReceiptController.getById
);

// Criar recebimento
router.post(
  '/',
  requirePermission('recebimentos_compra', 'criar'),
  purchaseReceiptController.create
);

// Cancelar recebimento
router.delete(
  '/:id',
  requirePermission('recebimentos_compra', 'excluir'),
  purchaseReceiptController.cancel
);

export default router;
