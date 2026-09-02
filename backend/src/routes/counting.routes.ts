import { Router } from 'express';
import countingPlanController from '../controllers/counting-plan.controller';
import countingSessionController from '../controllers/counting-session.controller';
import countingItemController from '../controllers/counting-item.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
// ✅ F0.7 do plano do WMS (pendência da Fase 2 item 2.2): validators Joi para o
// módulo de contagem, que até então era o último conjunto de endpoints mutantes
// do backend sem nenhuma validação de entrada.
import { validate } from '../middleware/validation.middleware';
import {
  createCountingPlanSchema,
  updateCountingPlanSchema,
  createCountingSessionSchema,
  countItemSchema,
  recountItemSchema,
  itemReasonSchema,
} from '../validators/counting.validator';
// Importar novos controllers
import countingPlanProductRouter from './counting-plan-product.routes';
import countingAssignmentRouter from './counting-assignment.routes';

const router = Router();

// Endpoint de teste (sem autenticação)
router.get('/test', (_req, res) => {
  res.json({ message: 'Counting routes are working!' });
});

// Aplicar autenticação em todas as rotas
router.use(authMiddleware);

// ============================================
// ROTAS DE PLANOS DE CONTAGEM
// ============================================

// Listar planos
router.get('/plans', requirePermission('planos_contagem', 'visualizar'), countingPlanController.index);

// Buscar plano por ID
router.get('/plans/:id', requirePermission('planos_contagem', 'visualizar'), countingPlanController.show);

// Criar plano
router.post('/plans', requirePermission('planos_contagem', 'criar'), validate(createCountingPlanSchema), countingPlanController.create);

// Atualizar plano
router.put('/plans/:id', requirePermission('planos_contagem', 'editar'), validate(updateCountingPlanSchema), countingPlanController.update);

// Deletar plano
router.delete('/plans/:id', requirePermission('planos_contagem', 'excluir'), countingPlanController.delete);

// Ativar plano
router.patch('/plans/:id/activate', requirePermission('planos_contagem', 'ativar'), countingPlanController.activate);

// Pausar plano
router.patch('/plans/:id/pause', requirePermission('planos_contagem', 'pausar'), countingPlanController.pause);

// Cancelar plano
router.patch('/plans/:id/cancel', requirePermission('planos_contagem', 'excluir'), countingPlanController.cancel);

// Visualizar produtos do plano
router.get('/plans/:id/products', requirePermission('planos_contagem', 'visualizar'), countingPlanController.getProducts);

// ============================================
// ROTAS DE SESSÕES DE CONTAGEM
// ============================================

// Dashboard
router.get('/dashboard', requirePermission('sessoes_contagem', 'visualizar'), countingSessionController.getDashboard);

// Listar sessões
router.get('/sessions', requirePermission('sessoes_contagem', 'visualizar'), countingSessionController.index);

// Buscar sessão por ID
router.get('/sessions/:id', requirePermission('sessoes_contagem', 'visualizar'), countingSessionController.show);

// Criar sessão
router.post('/sessions', requirePermission('sessoes_contagem', 'criar'), validate(createCountingSessionSchema), countingSessionController.create);

// Iniciar sessão
router.post('/sessions/:id/start', requirePermission('sessoes_contagem', 'iniciar'), countingSessionController.start);

// Completar sessão
router.post('/sessions/:id/complete', requirePermission('sessoes_contagem', 'completar'), countingSessionController.complete);

// Cancelar sessão
router.post('/sessions/:id/cancel', requirePermission('sessoes_contagem', 'cancelar'), countingSessionController.cancel);

// Gerar relatório
router.get('/sessions/:id/report', requirePermission('relatorios_contagem', 'visualizar'), countingSessionController.getReport);

// Ajustar estoque
router.post('/sessions/:id/adjust-stock', requirePermission('stock', 'adjustment'), countingSessionController.adjustStock);

// Buscar divergências da sessão
router.get('/sessions/:sessionId/divergences', requirePermission('sessoes_contagem', 'visualizar'), countingItemController.getDivergences);

// ============================================
// ROTAS DE ITENS DE CONTAGEM
// ============================================

// Listar itens
router.get('/items', requirePermission('contagem', 'executar'), countingItemController.index);

// Buscar item por ID
router.get('/items/:id', requirePermission('contagem', 'executar'), countingItemController.show);

// Contar item
router.post('/items/:id/count', requirePermission('contagem', 'executar'), validate(countItemSchema), countingItemController.count);

// Recontar item
router.post('/items/:id/recount', requirePermission('contagem', 'recontar'), validate(recountItemSchema), countingItemController.recount);

// Aceitar contagem
router.post('/items/:id/accept', requirePermission('contagem', 'aprovar_divergencia'), validate(itemReasonSchema), countingItemController.accept);

// Cancelar item
router.post('/items/:id/cancel', requirePermission('contagem', 'executar'), validate(itemReasonSchema), countingItemController.cancel);

// Itens pendentes do usuário
router.get('/items/pending/me', requirePermission('contagem', 'executar'), countingItemController.getPendingByUser);

// Estatísticas de produto
router.get('/products/:productId/stats', requirePermission('contagem', 'executar'), countingItemController.getProductStats);

// Adicionar novas rotas
router.use('/products', countingPlanProductRouter);
router.use('/assignments', countingAssignmentRouter);

export default router;
