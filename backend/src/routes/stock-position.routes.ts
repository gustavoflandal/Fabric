import { Router } from 'express';
import stockPositionController from '../controllers/stock-position.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validateQuery } from '../middleware/validation.middleware';
import { occupiedPositionsQuerySchema } from '../validators/stock-position.validator';

/**
 * F1.3 / F1.4 do plano do WMS — superfície de leitura do saldo por posição.
 *
 * `requireModule('WMS')` NÃO é aplicado aqui: ele entra no ponto de montagem em
 * `routes/index.ts`, igual às demais rotas de armazém (ver o comentário lá e em
 * `middleware/module.middleware.ts`). Uma linha por montagem protege o arquivo
 * inteiro, e rota nova já nasce protegida.
 *
 * RBAC — recursos REAPROVEITADOS, nenhum recurso novo criado:
 *   * `estruturas_armazem:visualizar` para as três leituras de saldo por
 *     endereço. É o mesmo recurso que já protege `GET /storage-positions/*`
 *     (listar posições de uma estrutura, buscar por código) e já está seedado e
 *     atribuído a MANAGER e OPERATOR — que são justamente quem opera armazém.
 *     Criar um `saldo_posicao` só para isso multiplicaria recurso sem
 *     multiplicar decisão de acesso: quem pode ver o endereço pode ver o que
 *     tem nele.
 *   * `stock:read` para o relatório de divergência. Ele compara
 *     `stock_position_balances` com `stock_balances`, ou seja, expõe o saldo
 *     agregado do produto — é leitura de ESTOQUE, não de endereçamento, e quem
 *     pode ler saldo já pode ver esses números por `GET /stock/balances`.
 */
const router = Router();

router.use(authMiddleware);

// Rotas de segmento FIXO declaradas antes das paramétricas. Aqui não há
// ambiguidade real (todos os caminhos têm prefixo próprio), mas manter a ordem
// evita que uma rota paramétrica futura na raiz capture `/occupied` e
// `/divergences`.

// F1.3 — divergência da invariante SUM(saldo por posição) <= saldo agregado.
router.get(
  '/divergences',
  requirePermission('stock', 'read'),
  stockPositionController.getDivergences
);

// F1.4 — posições ocupadas (saldo > 0) de um armazém ou de uma estrutura.
router.get(
  '/occupied',
  requirePermission('estruturas_armazem', 'visualizar'),
  validateQuery(occupiedPositionsQuerySchema),
  stockPositionController.getOccupiedPositions
);

// F1.4 — saldo de um produto detalhado por posição.
router.get(
  '/product/:productId',
  requirePermission('estruturas_armazem', 'visualizar'),
  stockPositionController.getBalancesByProduct
);

// F1.4 — todos os produtos com saldo em uma posição específica.
router.get(
  '/position/:positionId',
  requirePermission('estruturas_armazem', 'visualizar'),
  stockPositionController.getBalancesByPosition
);

export default router;
