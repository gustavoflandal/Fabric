import { Router } from 'express';
import unitOfMeasureController from '../controllers/unit-of-measure.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// GET /api/v1/units-of-measure - Listar todas
router.get('/', requirePermission('units_of_measure', 'read'), unitOfMeasureController.getAll);

// GET /api/v1/units-of-measure/:id - Buscar por ID
router.get('/:id', requirePermission('units_of_measure', 'read'), unitOfMeasureController.getById);

// POST /api/v1/units-of-measure - Criar nova
router.post('/', requirePermission('units_of_measure', 'create'), unitOfMeasureController.create);

// PUT /api/v1/units-of-measure/:id - Atualizar
router.put('/:id', requirePermission('units_of_measure', 'update'), unitOfMeasureController.update);

// DELETE /api/v1/units-of-measure/:id - Excluir
router.delete('/:id', requirePermission('units_of_measure', 'delete'), unitOfMeasureController.delete);

// PATCH /api/v1/units-of-measure/:id/toggle-active - Ativar/Desativar
router.patch('/:id/toggle-active', requirePermission('units_of_measure', 'update'), unitOfMeasureController.toggleActive);

export default router;
