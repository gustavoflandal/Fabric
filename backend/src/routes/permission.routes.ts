import { Router } from 'express';
import permissionController from '../controllers/permission.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// CRUD de permissões
router.get('/', permissionController.getAll);
router.get('/:id', permissionController.getById);
router.post('/', permissionController.create);
router.delete('/:id', permissionController.delete);

// Seed de permissões padrão
router.post('/seed/default', permissionController.seedDefault);

export default router;
