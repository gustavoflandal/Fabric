import { Router } from 'express';
import auditLogController from '../controllers/audit-log.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// Rotas de audit logs
// ✅ Fase 2 item 2.5 do cronograma: as 4 rotas de leitura não tinham
// requirePermission - qualquer usuário autenticado podia ver a trilha de
// auditoria inteira (ações, IPs, corpo de requisição/resposta de todos os
// usuários). Só o DELETE já era restrito.
router.get('/', requirePermission('audit_logs', 'read'), auditLogController.getAll);
router.get('/statistics', requirePermission('audit_logs', 'read'), auditLogController.getStatistics);
router.get('/:id', requirePermission('audit_logs', 'read'), auditLogController.getById);
router.get('/resource/:resource/:resourceId', requirePermission('audit_logs', 'read'), auditLogController.getByResource);
router.delete('/clean', requirePermission('audit_logs', 'delete'), auditLogController.deleteLogs);

export default router;
