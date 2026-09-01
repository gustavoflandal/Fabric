import { Router } from 'express';
import userController from '../controllers/user.controller';
import { validate } from '../middleware/validation.middleware';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import {
  createUserSchema,
  updateUserSchema,
  changePasswordSchema,
  assignRolesSchema,
} from '../validators/user.validator';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// Trocar a própria senha não exige permissão de gestão de usuários
router.put('/me/password', validate(changePasswordSchema), userController.changePassword);

// CRUD de usuários
router.get('/', requirePermission('users', 'read'), userController.getAll);
router.get('/:id', requirePermission('users', 'read'), userController.getById);
router.post('/', requirePermission('users', 'create'), validate(createUserSchema), userController.create);
router.put('/:id', requirePermission('users', 'update'), validate(updateUserSchema), userController.update);
router.delete('/:id', requirePermission('users', 'delete'), userController.delete);

// Atribuir perfis
router.post('/:id/roles', requirePermission('users', 'update'), validate(assignRolesSchema), userController.assignRoles);

export default router;
