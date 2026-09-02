import { Router } from 'express';
import * as storagePositionController from '../controllers/storage-position.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate, validateQuery } from '../middleware/validation.middleware';
import {
  updateStoragePositionSchema,
  positionMovementsQuerySchema,
} from '../validators/storage-position.validator';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// Gerar posições para uma estrutura
router.post(
  '/:structureId/generate',
  requirePermission('estruturas_armazem', 'gerar_posicoes'),
  storagePositionController.generatePositions
);

// F0.2: buscar posição pelo endereço (ARM-RUA-AA-PP). Declarada ANTES de
// '/:structureId' de propósito: apesar de ter dois segmentos (o que já a
// diferencia da rota de estrutura), manter a rota específica acima da
// paramétrica evita que uma futura mudança em '/:structureId' a capture.
// Mesmo RBAC das demais leituras de posição deste arquivo.
router.get(
  '/by-code/:code',
  requirePermission('estruturas_armazem', 'visualizar'),
  storagePositionController.getPositionByCode
);

// F2.4: histórico de movimentação de um endereço (linhas em que a posição é
// origem OU destino).
//
// Declarada antes de '/:structureId' pela mesma razão de '/by-code/:code': não
// há ambiguidade real (esta rota exige um segundo segmento literal
// 'movements', a de estrutura tem um segmento só), mas manter as rotas mais
// específicas acima da paramétrica evita que uma mudança futura em
// '/:structureId' as capture.
//
// `requireModule('WMS')` NÃO aparece aqui: ele já protege este arquivo inteiro
// no ponto de montagem em routes/index.ts, como todas as rotas de armazém.
//
// RBAC: `estruturas_armazem:visualizar`, o mesmo recurso das demais LEITURAS de
// posição deste arquivo e das leituras de saldo por endereço da Fase 1 — quem
// pode ver o endereço pode ver o que passou por ele. Nenhum recurso novo.
router.get(
  '/:id/movements',
  requirePermission('estruturas_armazem', 'visualizar'),
  validateQuery(positionMovementsQuerySchema),
  storagePositionController.getPositionMovements
);

// Listar posições de uma estrutura
router.get(
  '/:structureId',
  requirePermission('estruturas_armazem', 'visualizar'),
  storagePositionController.getPositionsByStructure
);

// Excluir todas as posições de uma estrutura
router.delete(
  '/:structureId',
  requirePermission('estruturas_armazem', 'excluir_posicoes'),
  storagePositionController.deletePositions
);

// Atualizar uma posição individual (bloquear/desbloquear)
//
// RBAC: `estruturas_armazem:atualizar_posicao`. Era `storage_positions:update`
// — o único par em inglês de todo o módulo de armazém, que usa
// `armazens`/`estruturas_armazem` em português. Renomeado para o mesmo recurso
// das outras cinco rotas deste arquivo, inclusive a de EXCLUIR esta mesma
// posição individual logo abaixo (`estruturas_armazem:excluir_posicoes`), com
// ação própria porque atualizar (bloquear/desbloquear) não é nem gerar nem
// excluir posição.
router.put(
  '/position/:positionId',
  requirePermission('estruturas_armazem', 'atualizar_posicao'),
  validate(updateStoragePositionSchema),
  storagePositionController.updatePosition
);

// Excluir uma posição individual
router.delete(
  '/position/:positionId',
  requirePermission('estruturas_armazem', 'excluir_posicoes'),
  storagePositionController.deletePosition
);

export default router;
