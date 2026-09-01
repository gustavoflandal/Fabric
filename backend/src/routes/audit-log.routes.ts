import { Router } from 'express';
import auditLogController from '../controllers/audit-log.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// Rotas de audit logs
router.get('/', auditLogController.getAll);
router.get('/statistics', auditLogController.getStatistics);
router.get('/:id', auditLogController.getById);
router.get('/resource/:resource/:resourceId', auditLogController.getByResource);
router.delete('/clean', requirePermission('audit_logs', 'delete'), auditLogController.deleteLogs);

export default router;
