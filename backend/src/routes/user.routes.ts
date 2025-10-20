import { Router } from 'express';
import userController from '../controllers/user.controller';
import { validate } from '../middleware/validation.middleware';
import { authMiddleware } from '../middleware/auth.middleware';
import {
  createUserSchema,
  updateUserSchema,
  changePasswordSchema,
  assignRolesSchema,
} from '../validators/user.validator';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// CRUD de usuários
router.get('/', userController.getAll);
router.get('/:id', userController.getById);
router.post('/', validate(createUserSchema), userController.create);
router.put('/:id', validate(updateUserSchema), userController.update);
router.delete('/:id', userController.delete);

// Trocar senha
router.put('/me/password', validate(changePasswordSchema), userController.changePassword);

// Atribuir perfis
router.post('/:id/roles', validate(assignRolesSchema), userController.assignRoles);

export default router;
