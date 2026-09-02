import { Router } from 'express';
import countingAssignmentController from '../controllers/counting-assignment.controller';
import { requirePermission } from '../middleware/permission.middleware';
// ✅ F0.7: validators do módulo de contagem.
import { validate } from '../middleware/validation.middleware';
import {
  assignCounterSchema,
  updateCounterRoleSchema,
} from '../validators/counting.validator';

const router = Router();

// Autenticação já é aplicada pelo router pai (counting.routes.ts, router.use(authMiddleware)
// antes de montar este sub-router). Reaproveita o recurso 'sessoes_contagem' - atribuição de
// contador é parte da gestão de sessões de contagem, sem recurso próprio seedado.

// Atribuir contador à sessão
router.post('/sessions/:sessionId/assign', requirePermission('sessoes_contagem', 'criar'), validate(assignCounterSchema), countingAssignmentController.assignUser);

// Remover atribuição
router.delete('/sessions/:sessionId/assign/:userId', requirePermission('sessoes_contagem', 'cancelar'), countingAssignmentController.unassignUser);

// Listar atribuições
router.get('/sessions/:sessionId/assign', requirePermission('sessoes_contagem', 'visualizar'), countingAssignmentController.listAssignments);

// Atualizar papel do contador
router.patch('/sessions/:sessionId/assign/:userId', requirePermission('sessoes_contagem', 'criar'), validate(updateCounterRoleSchema), countingAssignmentController.updateRole);

export default router;
