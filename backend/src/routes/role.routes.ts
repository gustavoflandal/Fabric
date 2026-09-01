import { Router } from 'express';
import roleController from '../controllers/role.controller';
import { validate } from '../middleware/validation.middleware';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import {
  createRoleSchema,
  updateRoleSchema,
  assignPermissionsSchema,
} from '../validators/role.validator';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// CRUD de perfis
router.get('/', requirePermission('roles', 'read'), roleController.getAll);
router.get('/:id', requirePermission('roles', 'read'), roleController.getById);
router.post('/', requirePermission('roles', 'create'), validate(createRoleSchema), roleController.create);
router.put('/:id', requirePermission('roles', 'update'), validate(updateRoleSchema), roleController.update);
router.delete('/:id', requirePermission('roles', 'delete'), roleController.delete);

// Atribuir permissões
router.post('/:id/permissions', requirePermission('roles', 'update'), validate(assignPermissionsSchema), roleController.assignPermissions);

export default router;
