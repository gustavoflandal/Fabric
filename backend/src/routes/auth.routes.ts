import { Router } from 'express';
import authController from '../controllers/auth.controller';
import { validate } from '../middleware/validation.middleware';
import { authMiddleware } from '../middleware/auth.middleware';
import { authLimiter } from '../middleware/rate-limit.middleware';
import { registerSchema, loginSchema, refreshTokenSchema } from '../validators/auth.validator';

const router = Router();

// Rotas públicas com rate limiting rigoroso
router.post('/register', authLimiter, validate(registerSchema), authController.register);
router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/refresh', validate(refreshTokenSchema), authController.refreshToken);

// Rotas protegidas
router.get('/me', authMiddleware, authController.getMe);
router.post('/logout', authMiddleware, authController.logout);

export default router;
