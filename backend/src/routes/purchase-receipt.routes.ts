import { Router } from 'express';
import purchaseReceiptController from '../controllers/purchase-receipt.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validation.middleware';
import { createPurchaseReceiptSchema, cancelPurchaseReceiptSchema, parseNfeSchema } from '../validators/purchase-receipt.validator';

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

// Parse de XML de NFe para pré-preencher o formulário de recebimento —
// segmento fixo, registrado antes de qualquer rota paramétrica do arquivo.
router.post(
  '/parse-nfe',
  requirePermission('recebimentos_compra', 'criar'),
  validate(parseNfeSchema),
  purchaseReceiptController.parseNfe
);

// Criar recebimento
router.post(
  '/',
  requirePermission('recebimentos_compra', 'criar'),
  validate(createPurchaseReceiptSchema),
  purchaseReceiptController.create
);

// Cancelar recebimento
router.delete(
  '/:id',
  requirePermission('recebimentos_compra', 'excluir'),
  validate(cancelPurchaseReceiptSchema),
  purchaseReceiptController.cancel
);

export default router;
