import { Router } from 'express';
import warehouseTaskController from '../controllers/warehouse-task.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate, validateQuery } from '../middleware/validation.middleware';
import {
  assignWarehouseTaskSchema,
  completeWarehouseTaskSchema,
  executeWarehouseTaskSchema,
  myWarehouseTasksQuerySchema,
  panelQuerySchema,
  putawayWarehouseTaskSchema,
  scanWarehouseTaskSchema,
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
 * ✅ FASE 4b — o recurso novo que a Fase 4a previu ("quando a Fase 4b trouxer
 * PICKING, essas rotas ganham o recurso delas"). Ele chegou: `tarefas_armazem`,
 * com três ações.
 *
 *   `tarefas_armazem:visualizar` → `GET /my`, `GET /production-order/:orderId`
 *   `tarefas_armazem:executar`   → `POST /:id/start`, `/scan`, `/execute`
 *   `tarefas_armazem:atribuir`   → `POST /:id/assign`
 *
 * POR QUE UM RECURSO NOVO, e não reaproveitar `recebimentos_compra` como a
 * Fase 4a fez: aquela reutilização se justificava porque TODA tarefa daquela
 * fase pertencia a um recebimento — exigir a permissão de recebimento para
 * concluir o recebimento era coerente. Deixou de ser: uma tarefa de `PICKING`
 * nasce de uma ordem de PRODUÇÃO e uma de `REPLENISHMENT` não nasce de
 * documento nenhum. Exigir `recebimentos_compra:criar` de um operador de
 * separação obrigaria a instalação a dar permissão de COMPRAS a quem só mexe no
 * armazém — e, numa instalação com WMS e sem o módulo COMPRAS, o recurso nem
 * sequer teria sido seedado.
 *
 * POR QUE TRÊS AÇÕES, e não uma: `executar` e `atribuir` são poderes
 * diferentes de pessoas diferentes (o operador executa o que lhe deram; o
 * supervisor distribui), e `visualizar` é o mínimo que o painel precisa. As
 * rotas de RECEBIMENTO acima continuam com `recebimentos_compra` — mudá-las
 * seria quebrar o RBAC de uma superfície que já está em uso.
 *
 * ORDEM DAS ROTAS: os segmentos fixos (`/my`, `/receipt/:id`,
 * `/production-order/:id`) vêm ANTES das paramétricas, mesma disciplina já
 * adotada em `storage-position.routes.ts`.
 */
const router = Router();

router.use(authMiddleware);

// F4.9/F4.11 — A FILA DO OPERADOR LOGADO. É a primeira rota do arquivo de
// propósito: é o endpoint mais chamado da superfície de coletor (é a tela
// inicial do dispositivo) e o segmento `/my` precisa vir antes de qualquer
// paramétrica.
router.get(
  '/my',
  requirePermission('tarefas_armazem', 'visualizar'),
  validateQuery(myWarehouseTasksQuerySchema),
  warehouseTaskController.getMyTasks
);

// Painel de operações — recebimentos ativos com a cadeia completa de
// tarefas. RBAC: `recebimentos_compra:visualizar`, o mesmo recurso de
// `GET /receipt/:receiptId` logo abaixo — é a mesma leitura, só agregada.
router.get(
  '/panel',
  requirePermission('recebimentos_compra', 'visualizar'),
  validateQuery(panelQuerySchema),
  warehouseTaskController.getPanel
);

// F4.5 — cadeia de tarefas de um recebimento. Segmento fixo (`/receipt/`) antes
// do id para não colidir com as rotas paramétricas abaixo.
router.get(
  '/receipt/:receiptId',
  requirePermission('recebimentos_compra', 'visualizar'),
  warehouseTaskController.getByReceipt
);

// F4.8 — as tarefas de separação de uma ordem de produção (a contrapartida de
// `/receipt/:id` do lado da saída).
router.get(
  '/production-order/:orderId',
  requirePermission('tarefas_armazem', 'visualizar'),
  warehouseTaskController.getByProductionOrder
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

// ============================================================================
// F4.9 / F4.11 — SUPERFÍCIE DE COLETOR E FILA DE OPERADOR
// ============================================================================

// F4.9 — atribuir/desatribuir. `atribuir` é ação SEPARADA de `executar`:
// distribuir trabalho é ato de supervisor, executá-lo é do operador.
router.post(
  '/:id/assign',
  requirePermission('tarefas_armazem', 'atribuir'),
  validate(assignWarehouseTaskSchema),
  warehouseTaskController.assign
);

// F4.11 — o operador encostou o coletor na tarefa (IN_PROGRESS + startedAt, e
// atribuição implícita se estava sem dono).
router.post(
  '/:id/start',
  requirePermission('tarefas_armazem', 'executar'),
  warehouseTaskController.start
);

// F4.11 — confirmação de leitura de código de barras. SEM efeito colateral: só
// valida o código lido contra o que a tarefa espera e devolve `ok: true/false`
// (sempre com HTTP 200 — ver a nota no service). Fica sob `executar`, e não
// `visualizar`, porque só faz sentido para quem está de fato tocando a tarefa.
router.post(
  '/:id/scan',
  requirePermission('tarefas_armazem', 'executar'),
  validate(scanWarehouseTaskSchema),
  warehouseTaskController.scan
);

// F4.8/F4.10 — conclusão de PICKING (saída `OUT` da posição de origem) e de
// REPLENISHMENT (transferência pulmão → picking), com a movimentação de estoque
// na MESMA transação da conclusão. Terceiro e último contrato de conclusão do
// arquivo — ver a tabela em `warehouse-task.service.ts::completeTask`.
router.post(
  '/:id/execute',
  requirePermission('tarefas_armazem', 'executar'),
  validate(executeWarehouseTaskSchema),
  warehouseTaskController.execute
);

export default router;
