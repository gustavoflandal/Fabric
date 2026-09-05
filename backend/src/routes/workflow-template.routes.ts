import { Router } from 'express';
import workflowTemplateController from '../controllers/workflow-template.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate, validateQuery } from '../middleware/validation.middleware';
import {
  createWorkflowTemplateSchema,
  listWorkflowTemplatesQuerySchema,
  updateWorkflowTemplateSchema,
} from '../validators/workflow-template.validator';

/**
 * F-WORKFLOW — MONTADO SOB `requireModule('WMS')` em routes/index.ts.
 *
 * RBAC — recurso REAPROVEITADO, `estruturas_armazem`, mesmo precedente de
 * `storage-rule.routes.ts`: quem desenha a estrutura física do armazém é
 * quem desenha o fluxo de operação dela.
 */
const router = Router();

router.use(authMiddleware);

router.get(
  '/',
  requirePermission('estruturas_armazem', 'visualizar'),
  validateQuery(listWorkflowTemplatesQuerySchema),
  workflowTemplateController.list
);

router.get(
  '/:id',
  requirePermission('estruturas_armazem', 'visualizar'),
  workflowTemplateController.getById
);

router.post(
  '/',
  requirePermission('estruturas_armazem', 'criar'),
  validate(createWorkflowTemplateSchema),
  workflowTemplateController.create
);

router.post(
  '/:id/duplicate',
  requirePermission('estruturas_armazem', 'criar'),
  workflowTemplateController.duplicate
);

router.put(
  '/:id',
  requirePermission('estruturas_armazem', 'editar'),
  validate(updateWorkflowTemplateSchema),
  workflowTemplateController.update
);

router.delete(
  '/:id',
  requirePermission('estruturas_armazem', 'excluir'),
  workflowTemplateController.remove
);

export default router;
