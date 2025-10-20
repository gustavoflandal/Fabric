import { Router } from 'express';
import roleController from '../controllers/role.controller';
import { validate } from '../middleware/validation.middleware';
import { authMiddleware } from '../middleware/auth.middleware';
import {
  createRoleSchema,
  updateRoleSchema,
  assignPermissionsSchema,
} from '../validators/role.validator';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// CRUD de perfis
router.get('/', roleController.getAll);
router.get('/:id', roleController.getById);
router.post('/', validate(createRoleSchema), roleController.create);
router.put('/:id', validate(updateRoleSchema), roleController.update);
router.delete('/:id', roleController.delete);

// Atribuir permissões
router.post('/:id/permissions', validate(assignPermissionsSchema), roleController.assignPermissions);

export default router;
