import { Router } from 'express';
import shipmentController from '../controllers/shipment.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate, validateQuery } from '../middleware/validation.middleware';
import {
  createShipmentSchema,
  listShipmentQuerySchema,
} from '../validators/shipment.validator';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// Listar romaneios
router.get(
  '/',
  requirePermission('expedicao', 'visualizar'),
  validateQuery(listShipmentQuerySchema),
  shipmentController.getAll
);

// Detalhe (inclui as tarefas de picking do romaneio — ver `shipment.service.ts`)
router.get('/:id', requirePermission('expedicao', 'visualizar'), shipmentController.getById);

// Criar romaneio a partir de um pedido de venda (admite expedição parcial)
router.post(
  '/',
  requirePermission('expedicao', 'criar'),
  validate(createShipmentSchema),
  shipmentController.create
);

// Iniciar separação: planeja FIFO/FEFO e cria as tarefas de PICKING.
// Permissão PRÓPRIA (`separar`) e não `criar`: quem monta o romaneio no
// escritório não é necessariamente quem libera trabalho para o armazém — mesmo
// critério que separa `tarefas_armazem:executar` de `:atribuir`.
router.post(
  '/:id/start-separation',
  requirePermission('expedicao', 'separar'),
  shipmentController.startSeparation
);

// Despachar: exige todas as tarefas de separação COMPLETED. Não movimenta
// estoque (ver a nota no service).
router.post(
  '/:id/dispatch',
  requirePermission('expedicao', 'despachar'),
  shipmentController.dispatch
);

// Cancelar (só antes do despacho)
router.post(
  '/:id/cancel',
  requirePermission('expedicao', 'cancelar'),
  shipmentController.cancel
);

export default router;
