import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import helpController from '../controllers/help.controller';

const router = Router();

// Ajuda é conteúdo cross-módulo, sem gate de licenciamento nem permissão
// específica — qualquer usuário autenticado pode consultar.
router.use(authMiddleware);

/**
 * @route   GET /api/v1/help
 * @desc    Conteúdo em Markdown do manual do usuário (mesmo arquivo
 *          indexado no ChromaDB pelo assistente de IA — fonte única).
 * @access  Private
 */
router.get('/', helpController.getContent);

export default router;
