import { Router } from 'express';
import countingAssignmentController from '../controllers/counting-assignment.controller';

const router = Router();

// Atribuir contador à sessão
router.post('/sessions/:sessionId/assign', countingAssignmentController.assignUser);

// Remover atribuição
router.delete('/sessions/:sessionId/assign/:userId', countingAssignmentController.unassignUser);

// Listar atribuições
router.get('/sessions/:sessionId/assign', countingAssignmentController.listAssignments);

// Atualizar papel do contador
router.patch('/sessions/:sessionId/assign/:userId', countingAssignmentController.updateRole);

export default router;
