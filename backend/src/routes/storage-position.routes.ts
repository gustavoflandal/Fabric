import { Router } from 'express';
import * as storagePositionController from '../controllers/storage-position.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// Gerar posições para uma estrutura
router.post(
  '/:structureId/generate',
  requirePermission('estruturas_armazem', 'gerar_posicoes'),
  storagePositionController.generatePositions
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
  storagePositionController.updatePosition
);

// Excluir uma posição individual
router.delete(
  '/position/:positionId',
  requirePermission('estruturas_armazem', 'excluir_posicoes'),
  storagePositionController.deletePosition
);

export default router;
