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
  requirePermission('purchases', 'read'),
  purchaseReceiptController.getAll
);

// Buscar recebimento por ID
router.get(
  '/:id',
  requirePermission('purchases', 'read'),
  purchaseReceiptController.getById
);

// Criar recebimento
router.post(
  '/',
  requirePermission('purchases', 'create'),
  purchaseReceiptController.create
);

// Cancelar recebimento
router.delete(
  '/:id',
  requirePermission('purchases', 'delete'),
  purchaseReceiptController.cancel
);

export default router;
