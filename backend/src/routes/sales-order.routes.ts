import { Router } from 'express';
import salesOrderController from '../controllers/sales-order.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate, validateQuery } from '../middleware/validation.middleware';
import {
  createSalesOrderSchema,
  listSalesOrderQuerySchema,
  updateSalesOrderSchema,
} from '../validators/sales-order.validator';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// Listar pedidos de venda
router.get(
  '/',
  requirePermission('pedidos_venda', 'visualizar'),
  validateQuery(listSalesOrderQuerySchema),
  salesOrderController.getAll
);

// Buscar por ID
router.get(
  '/:id',
  requirePermission('pedidos_venda', 'visualizar'),
  salesOrderController.getById
);

// Criar pedido (nasce DRAFT)
router.post(
  '/',
  requirePermission('pedidos_venda', 'criar'),
  validate(createSalesOrderSchema),
  salesOrderController.create
);

// Atualizar pedido (só em DRAFT)
router.put(
  '/:id',
  requirePermission('pedidos_venda', 'editar'),
  validate(updateSalesOrderSchema),
  salesOrderController.update
);

// Transições de status são POST /:id/<acao>, não um PATCH genérico de status:
// o pedido de venda não tem setter de status (ver a nota em
// `sales-order.service.ts`), então cada avanço é uma rota nomeada com a sua
// própria permissão.
router.post(
  '/:id/confirm',
  requirePermission('pedidos_venda', 'confirmar'),
  salesOrderController.confirm
);

router.post(
  '/:id/cancel',
  requirePermission('pedidos_venda', 'cancelar'),
  salesOrderController.cancel
);

// Excluir pedido (só DRAFT e sem romaneios).
//
// Reaproveita `pedidos_venda:editar` em vez de criar uma ação `excluir`
// própria: a exclusão aqui só alcança RASCUNHO sem nenhum documento
// dependente — é a última forma de "desfazer a digitação", não a remoção de um
// documento que já circulou. (Compras tem `pedidos_compra:excluir` separado
// porque lá o delete alcança pedido já aprovado.)
router.delete(
  '/:id',
  requirePermission('pedidos_venda', 'editar'),
  salesOrderController.delete
);

export default router;
