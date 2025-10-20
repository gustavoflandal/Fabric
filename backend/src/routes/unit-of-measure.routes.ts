import { Router } from 'express';
import unitOfMeasureController from '../controllers/unit-of-measure.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// GET /api/v1/units-of-measure - Listar todas
router.get('/', unitOfMeasureController.getAll);

// GET /api/v1/units-of-measure/:id - Buscar por ID
router.get('/:id', unitOfMeasureController.getById);

// POST /api/v1/units-of-measure - Criar nova
router.post('/', unitOfMeasureController.create);

// PUT /api/v1/units-of-measure/:id - Atualizar
router.put('/:id', unitOfMeasureController.update);

// DELETE /api/v1/units-of-measure/:id - Excluir
router.delete('/:id', unitOfMeasureController.delete);

// PATCH /api/v1/units-of-measure/:id/toggle-active - Ativar/Desativar
router.patch('/:id/toggle-active', unitOfMeasureController.toggleActive);

export default router;
