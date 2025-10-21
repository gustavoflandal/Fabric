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
  requirePermission('orcamentos_compra', 'visualizar'),
  purchaseQuotationController.getAll
);

// Buscar por fornecedor
router.get(
  '/supplier/:supplierId',
  requirePermission('orcamentos_compra', 'visualizar'),
  purchaseQuotationController.getBySupplier
);

// Buscar por ID
router.get(
  '/:id',
  requirePermission('orcamentos_compra', 'visualizar'),
  purchaseQuotationController.getById
);

// Criar orçamento
router.post(
  '/',
  requirePermission('orcamentos_compra', 'criar'),
  purchaseQuotationController.create
);

// Atualizar orçamento
router.put(
  '/:id',
  requirePermission('orcamentos_compra', 'editar'),
  purchaseQuotationController.update
);

// Atualizar status
router.patch(
  '/:id/status',
  requirePermission('orcamentos_compra', 'editar'),
  purchaseQuotationController.updateStatus
);

// Aprovar orçamento
router.patch(
  '/:id/approve',
  requirePermission('orcamentos_compra', 'aprovar'),
  purchaseQuotationController.approve
);

// Rejeitar orçamento
router.patch(
  '/:id/reject',
  requirePermission('orcamentos_compra', 'rejeitar'),
  purchaseQuotationController.reject
);

// Excluir orçamento
router.delete(
  '/:id',
  requirePermission('orcamentos_compra', 'excluir'),
  purchaseQuotationController.delete
);

export default router;
