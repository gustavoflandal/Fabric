import { Router } from 'express';
import authController from '../controllers/auth.controller';
import { validate } from '../middleware/validation.middleware';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { authLimiter } from '../middleware/rate-limit.middleware';
import { registerSchema, loginSchema, refreshTokenSchema } from '../validators/auth.validator';

const router = Router();

// Rotas públicas com rate limiting rigoroso
router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/refresh', authLimiter, validate(refreshTokenSchema), authController.refreshToken);

// Rotas protegidas
router.get('/me', authMiddleware, authController.getMe);
router.post('/logout', authMiddleware, authController.logout);

// Auto-cadastro público removido (Sprint 0 - ANALISE_FALHAS_SISTEMA/cronograma item 0.2):
// criação de contas passa a exigir permissão de gestão de usuários, igual ao POST /users.
router.post('/register', authMiddleware, requirePermission('users', 'create'), validate(registerSchema), authController.register);

export default router;
