import { Router } from 'express';
import * as storagePositionController from '../controllers/storage-position.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validation.middleware';
import { updateStoragePositionSchema } from '../validators/storage-position.validator';

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
router.put(
  '/position/:positionId',
  requirePermission('storage_positions', 'update'),
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
