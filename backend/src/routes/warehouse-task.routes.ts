import { Router } from 'express';
import warehouseTaskController from '../controllers/warehouse-task.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  completeWarehouseTaskSchema,
  putawayWarehouseTaskSchema,
} from '../validators/warehouse-task.validator';

/**
 * F4.3 / F4.4 / F4.5 do plano do WMS — superfície de tarefa de armazém.
 *
 * ONDE ISTO É MONTADO E POR QUÊ: `/warehouse-tasks`, sob
 * `requireModule('WMS')` em `routes/index.ts` (ver o comentário lá) — e NÃO
 * pendurado em `/purchase-receipts/:id/tasks`. Duas razões:
 *
 *   1. `/purchase-receipts` está sob `requireModule('COMPRAS')`. Tarefa de
 *      armazém é uma entidade do WMS; montada ali, uma instalação com COMPRAS e
 *      sem WMS veria as rotas existirem (e falharem por outro motivo) em vez de
 *      404 — o oposto do que o mecanismo de licenciamento promete.
 *   2. A Fase 4b acrescenta `GET /warehouse-tasks/my`, `POST /:id/start` e
 *      `POST /:id/scan` (F4.11, a API de coletor), além de tarefas de PICKING e
 *      REPLENISHMENT que não têm recebimento nenhum por trás. Este arquivo é o
 *      lugar delas; encaixá-las sob compras seria insustentável.
 *
 * RBAC — recursos REAPROVEITADOS, nenhum recurso novo:
 *   * `recebimentos_compra:visualizar` para a leitura da cadeia.
 *   * `recebimentos_compra:criar` para as duas conclusões. É deliberado que a
 *     conclusão exija a MESMA permissão que registrar o recebimento: com WMS
 *     licenciado, "receber" deixou de ser um ato só — quem endereça é quem, na
 *     prática, completa o recebimento e dá entrada no estoque. Exigir menos do
 *     segundo passo do que do primeiro seria um rebaixamento silencioso do
 *     controle de acesso do fluxo de compras.
 *     Os dois recursos já estão seedados e atribuídos a MANAGER e OPERATOR
 *     (`prisma/seed.ts`) — que são exatamente quem opera recebimento e armazém.
 *
 * Toda tarefa desta metade da fase pertence a um `PurchaseReceipt`, então o
 * recurso de compras cobre 100% da superfície. Quando a Fase 4b trouxer PICKING
 * (que não depende de COMPRAS — ver seção 3.5 de
 * `04_ARQUITETURA_MODULAR_LICENCIAMENTO.md`), essas rotas ganham o recurso
 * delas; não faz sentido antecipar um recurso para um caso de uso que ainda não
 * existe.
 */
const router = Router();

router.use(authMiddleware);

// F4.5 — cadeia de tarefas de um recebimento. Segmento fixo (`/receipt/`) antes
// do id para não colidir com as rotas paramétricas abaixo.
router.get(
  '/receipt/:receiptId',
  requirePermission('recebimentos_compra', 'visualizar'),
  warehouseTaskController.getByReceipt
);

// F4.3 — conclusão sem efeito colateral de estoque. Recusa ALOCACAO com 400 e
// aponta a rota certa (ver `warehouse-task.service.ts::completeTask`).
router.post(
  '/:id/complete',
  requirePermission('recebimentos_compra', 'criar'),
  validate(completeWarehouseTaskSchema),
  warehouseTaskController.complete
);

// F4.4/F4.5 — conclusão da ALOCACAO: cria o `ReceiptPutaway` e a movimentação
// `IN` com `toPositionId`, na mesma transação. Pode ser chamada mais de uma vez
// para a mesma tarefa (um item dividido entre posições); a tarefa e o
// recebimento fecham quando todo `acceptedQty` estiver coberto.
router.post(
  '/:id/putaway',
  requirePermission('recebimentos_compra', 'criar'),
  validate(putawayWarehouseTaskSchema),
  warehouseTaskController.putaway
);

export default router;
