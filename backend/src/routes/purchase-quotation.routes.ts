import { Router } from 'express';
import purchaseQuotationController from '../controllers/purchase-quotation.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// Listar orçamentos
router.get(
  '/',
  requirePermission('purchases', 'read'),
  purchaseQuotationController.getAll
);

// Buscar por fornecedor
router.get(
  '/supplier/:supplierId',
  requirePermission('purchases', 'read'),
  purchaseQuotationController.getBySupplier
);

// Buscar por ID
router.get(
  '/:id',
  requirePermission('purchases', 'read'),
  purchaseQuotationController.getById
);

// Criar orçamento
router.post(
  '/',
  requirePermission('purchases', 'create'),
  purchaseQuotationController.create
);

// Atualizar orçamento
router.put(
  '/:id',
  requirePermission('purchases', 'update'),
  purchaseQuotationController.update
);

// Atualizar status
router.patch(
  '/:id/status',
  requirePermission('purchases', 'update'),
  purchaseQuotationController.updateStatus
);

// Aprovar orçamento
router.patch(
  '/:id/approve',
  requirePermission('purchases', 'approve_quotation'),
  purchaseQuotationController.approve
);

// Rejeitar orçamento
router.patch(
  '/:id/reject',
  requirePermission('purchases', 'approve_quotation'),
  purchaseQuotationController.reject
);

// Excluir orçamento
router.delete(
  '/:id',
  requirePermission('purchases', 'delete'),
  purchaseQuotationController.delete
);

export default router;
