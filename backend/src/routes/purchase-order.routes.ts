import { Router } from 'express';
import purchaseOrderController from '../controllers/purchase-order.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// Listar pedidos
router.get(
  '/',
  requirePermission('purchases', 'read'),
  purchaseOrderController.getAll
);

// Buscar pedidos pendentes
router.get(
  '/pending',
  requirePermission('purchases', 'read'),
  purchaseOrderController.getPendingOrders
);

// Buscar por fornecedor
router.get(
  '/supplier/:supplierId',
  requirePermission('purchases', 'read'),
  purchaseOrderController.getBySupplier
);

// Buscar por ID
router.get(
  '/:id',
  requirePermission('purchases', 'read'),
  purchaseOrderController.getById
);

// Criar pedido
router.post(
  '/',
  requirePermission('purchases', 'create'),
  purchaseOrderController.create
);

// Criar pedido a partir de orçamento
router.post(
  '/from-quotation',
  requirePermission('purchases', 'create'),
  purchaseOrderController.createFromQuotation
);

// Atualizar pedido
router.put(
  '/:id',
  requirePermission('purchases', 'update'),
  purchaseOrderController.update
);

// Atualizar status
router.patch(
  '/:id/status',
  requirePermission('purchases', 'update'),
  purchaseOrderController.updateStatus
);

// Aprovar pedido
router.patch(
  '/:id/approve',
  requirePermission('purchases', 'approve_order'),
  purchaseOrderController.approve
);

// Confirmar pedido
router.patch(
  '/:id/confirm',
  requirePermission('purchases', 'update'),
  purchaseOrderController.confirm
);

// Cancelar pedido
router.patch(
  '/:id/cancel',
  requirePermission('purchases', 'update'),
  purchaseOrderController.cancel
);

// Excluir pedido
router.delete(
  '/:id',
  requirePermission('purchases', 'delete'),
  purchaseOrderController.delete
);

export default router;
