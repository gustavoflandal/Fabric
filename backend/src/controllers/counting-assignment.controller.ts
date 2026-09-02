import { Request, Response, NextFunction } from 'express';
import countingAssignmentService from '../services/counting-assignment.service';

class CountingAssignmentController {
  /**
   * POST /api/counting/sessions/:sessionId/assign
   * Atribuir contador à sessão
   */
  async assignUser(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId } = req.params;
      const { userId, role } = req.body;

      const result = await countingAssignmentService.assignUser(sessionId, userId, role);
      res.status(201).json(result);
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * DELETE /api/counting/sessions/:sessionId/assign/:userId
   * Remover atribuição
   */
  async unassignUser(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId, userId } = req.params;
      await countingAssignmentService.unassignUser(sessionId, userId);
      res.status(204).send();
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * GET /api/counting/sessions/:sessionId/assign
   * Listar atribuições
   */
  async listAssignments(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId } = req.params;
      const assignments = await countingAssignmentService.listAssignments(sessionId);
      res.json(assignments);
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * PATCH /api/counting/sessions/:sessionId/assign/:userId
   * Atualizar papel do contador
   */
  async updateRole(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId, userId } = req.params;
      const { role } = req.body;

      const result = await countingAssignmentService.updateRole(sessionId, userId, role);
      res.json(result);
    } catch (error: any) {
      next(error);
    }
  }
}

export default new CountingAssignmentController();
