import { Router } from 'express';
import stockController from '../controllers/stock.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { requireModule } from '../middleware/module.middleware';
import { validate, validateQuery } from '../middleware/validation.middleware';
import { transferSchema, movementsQuerySchema } from '../validators/stock.validator';

const router = Router();

router.use(authMiddleware);

router.get('/summary', requirePermission('stock', 'read'), stockController.getSummary);
router.get('/balances', requirePermission('stock', 'read'), stockController.getAllBalances);
router.get('/balance/:productId', requirePermission('stock', 'read'), stockController.getBalance);
router.get('/low-stock', requirePermission('stock', 'read'), stockController.getLowStock);
router.get('/excess-stock', requirePermission('stock', 'read'), stockController.getExcessStock);
// F2.4: mesma rota de sempre, agora aceitando `?positionId=` para recortar o
// histórico do produto a um endereço. SEM `requireModule('WMS')`: é uma rota de
// `/stock`, que existe para toda instalação (inclusive só-PCP) — o filtro é
// aditivo e simplesmente não é usado por quem não tem endereço. Bloquear a rota
// por módulo aqui quebraria o núcleo.
router.get(
  '/movements/:productId',
  requirePermission('stock', 'read'),
  validateQuery(movementsQuerySchema),
  stockController.getMovements
);
router.post('/entry', requirePermission('stock', 'entry'), stockController.registerEntry);
router.post('/exit', requirePermission('stock', 'exit'), stockController.registerExit);
router.post(
  '/adjustment',
  requirePermission('stock', 'adjustment'),
  stockController.registerAdjustment
);
/**
 * F2.3 do plano do WMS — transferência interna entre dois endereços.
 *
 * `requireModule('WMS')` NA PRÓPRIA ROTA, e não no ponto de montagem: este
 * arquivo é montado em `/stock`, que é núcleo (PCP) e NÃO passa por
 * `requireModule` em routes/index.ts. Transferir material entre endereços, por
 * outro lado, só existe com WMS licenciado — é a única rota de `/stock` que
 * pertence ao módulo, então a checagem é pontual aqui. Ordem preservada:
 * authMiddleware (router.use acima) -> requireModule -> requirePermission.
 *
 * RBAC — `estruturas_armazem:atualizar_posicao` (era `storage_positions:update`,
 * renomeado para a convenção portuguesa do módulo de armazém), recurso
 * REAPROVEITADO, nenhum criado:
 *   * é a permissão de ESCRITA sobre endereço que já existe (seed) e que já
 *     está atribuída a MANAGER e OPERATOR — exatamente quem opera o armazém;
 *   * transferência não altera o saldo agregado do produto, só o conteúdo de
 *     dois endereços; é operação de armazenagem, não de estoque no sentido de
 *     `stock:entry`/`stock:exit` (que mudam quanto a empresa tem).
 * A alternativa considerada foi `stock:update` (usada pela reserva logo
 * abaixo, com a nota "ação genérica de movimentação"); foi descartada porque
 * daria a quem só mexe com estoque agregado o poder de mover material entre
 * endereços físicos, e porque criar um `stock:transfer` novo exigiria migrar o
 * seed de permissões de instalações existentes sem multiplicar decisão de
 * acesso.
 */
router.post(
  '/transfer',
  requireModule('WMS'),
  requirePermission('estruturas_armazem', 'atualizar_posicao'),
  validate(transferSchema),
  stockController.transfer
);

// Não há ação dedicada para reserva; usa a ação genérica de movimentação de estoque
router.post(
  '/reserve/:orderId',
  requirePermission('stock', 'update'),
  stockController.reserveForOrder
);

export default router;
