import { Router } from 'express';
import * as assistantController from '../controllers/assistant.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validation.middleware';
import { chatSchema } from '../validators/assistant.validator';

const router = Router();

router.use(authMiddleware);

router.post('/chat', requirePermission('assistente_ia', 'usar'), validate(chatSchema), assistantController.chat);

export default router;
