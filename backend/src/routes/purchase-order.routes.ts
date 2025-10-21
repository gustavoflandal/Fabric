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
  requirePermission('pedidos_compra', 'visualizar'),
  purchaseOrderController.getAll
);

// Buscar pedidos pendentes
router.get(
  '/pending',
  requirePermission('pedidos_compra', 'visualizar'),
  purchaseOrderController.getPendingOrders
);

// Buscar por fornecedor
router.get(
  '/supplier/:supplierId',
  requirePermission('pedidos_compra', 'visualizar'),
  purchaseOrderController.getBySupplier
);

// Buscar por ID
router.get(
  '/:id',
  requirePermission('pedidos_compra', 'visualizar'),
  purchaseOrderController.getById
);

// Criar pedido
router.post(
  '/',
  requirePermission('pedidos_compra', 'criar'),
  purchaseOrderController.create
);

// Criar pedido a partir de orçamento
router.post(
  '/from-quotation',
  requirePermission('pedidos_compra', 'criar'),
  purchaseOrderController.createFromQuotation
);

// Atualizar pedido
router.put(
  '/:id',
  requirePermission('pedidos_compra', 'editar'),
  purchaseOrderController.update
);

// Atualizar status
router.patch(
  '/:id/status',
  requirePermission('pedidos_compra', 'editar'),
  purchaseOrderController.updateStatus
);

// Aprovar pedido
router.patch(
  '/:id/approve',
  requirePermission('pedidos_compra', 'aprovar'),
  purchaseOrderController.approve
);

// Confirmar pedido
router.patch(
  '/:id/confirm',
  requirePermission('pedidos_compra', 'editar'),
  purchaseOrderController.confirm
);

// Cancelar pedido
router.patch(
  '/:id/cancel',
  requirePermission('pedidos_compra', 'editar'),
  purchaseOrderController.cancel
);

// Excluir pedido
router.delete(
  '/:id',
  requirePermission('pedidos_compra', 'excluir'),
  purchaseOrderController.delete
);

export default router;
