import { Router } from 'express';
import permissionController from '../controllers/permission.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// Não existe um recurso 'permissions' seedado (ver backend/prisma/seed.ts) para não
// travar o próprio administrador fora do sistema; gestão de permissões usa o mesmo
// escopo de 'roles'. Revisar em Fase 2 do cronograma quando o RBAC for granularizado.
router.get('/', requirePermission('roles', 'read'), permissionController.getAll);
router.get('/:id', requirePermission('roles', 'read'), permissionController.getById);
router.post('/', requirePermission('roles', 'update'), permissionController.create);
router.delete('/:id', requirePermission('roles', 'update'), permissionController.delete);

// A rota POST /permissions/seed/default foi removida: mantinha uma segunda lista de
// permissões divergente da fonte de verdade. Para adicionar uma permissão nova,
// declare-a em backend/prisma/seed.ts e rode o seed (ver docs/PERMISSOES_SISTEMA.md).

export default router;
