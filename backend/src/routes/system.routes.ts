import { Router } from 'express';
import * as systemController from '../controllers/system.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// F0.8: módulos licenciados desta instalação (ver system.controller.ts para o
// motivo de não haver requirePermission aqui).
router.get('/licensed-modules', systemController.getLicensedModules);

export default router;
