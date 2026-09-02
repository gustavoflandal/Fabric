import { StockMovementType } from '@prisma/client';

/**
 * F2.2 do plano do WMS
 * (docs/fase-2026-09-modernizacao/WMS_IMPLEMENTATION_ANALYSIS.md, seção 5,
 * Fase 2) — os tipos de movimentação que MEXEM no saldo agregado do produto
 * (`stock_balances`).
 *
 * `TRANSFER` fica de fora: transferência interna não muda QUANTO existe do
 * produto, só ONDE está (é o único tipo que `applyMovement()` aplica sem
 * escrever em `stock_balances`). Todo código que deriva saldo somando o
 * histórico de `stock_movements` — mrp.service, notification-detector.service,
 * counting-session.service — precisa filtrar por esta lista; sem o filtro, uma
 * transferência entraria na conta como saída (ou entrada) e o saldo derivado
 * divergiria do real a cada movimentação de armazém.
 *
 * Por que mora em `utils/` e não em `stock.service.ts`, que é o dono do
 * conceito: `stock.service.ts` importa `notification-detector.service.ts`, que
 * é um dos consumidores desta lista — importar de volta fecharia um ciclo de
 * módulos. Este arquivo não depende de nada além do client do Prisma, então
 * qualquer um pode importá-lo com segurança. `stock.service.ts` o reexporta,
 * para quem já importa de lá.
 */
export const AGGREGATE_MOVEMENT_TYPES: StockMovementType[] = [
  StockMovementType.IN,
  StockMovementType.OUT,
  StockMovementType.ADJUSTMENT,
];
