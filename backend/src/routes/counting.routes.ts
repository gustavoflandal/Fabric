import { Router } from 'express';
import countingPlanController from '../controllers/counting-plan.controller';
import countingSessionController from '../controllers/counting-session.controller';
import countingItemController from '../controllers/counting-item.controller';
import { authMiddleware } from '../middleware/auth.middleware';

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
router.get('/plans', countingPlanController.index);

// Buscar plano por ID
router.get('/plans/:id', countingPlanController.show);

// Criar plano
router.post('/plans', countingPlanController.create);

// Atualizar plano
router.put('/plans/:id', countingPlanController.update);

// Deletar plano
router.delete('/plans/:id', countingPlanController.delete);

// Ativar plano
router.patch('/plans/:id/activate', countingPlanController.activate);

// Pausar plano
router.patch('/plans/:id/pause', countingPlanController.pause);

// Cancelar plano
router.patch('/plans/:id/cancel', countingPlanController.cancel);

// Visualizar produtos do plano
router.get('/plans/:id/products', countingPlanController.getProducts);

// ============================================
// ROTAS DE SESSÕES DE CONTAGEM
// ============================================

// Dashboard
router.get('/dashboard', countingSessionController.getDashboard);

// Listar sessões
router.get('/sessions', countingSessionController.index);

// Buscar sessão por ID
router.get('/sessions/:id', countingSessionController.show);

// Criar sessão
router.post('/sessions', countingSessionController.create);

// Iniciar sessão
router.post('/sessions/:id/start', countingSessionController.start);

// Completar sessão
router.post('/sessions/:id/complete', countingSessionController.complete);

// Cancelar sessão
router.post('/sessions/:id/cancel', countingSessionController.cancel);

// Gerar relatório
router.get('/sessions/:id/report', countingSessionController.getReport);

// Ajustar estoque
router.post('/sessions/:id/adjust-stock', countingSessionController.adjustStock);

// Buscar divergências da sessão
router.get('/sessions/:sessionId/divergences', countingItemController.getDivergences);

// ============================================
// ROTAS DE ITENS DE CONTAGEM
// ============================================

// Listar itens
router.get('/items', countingItemController.index);

// Buscar item por ID
router.get('/items/:id', countingItemController.show);

// Contar item
router.post('/items/:id/count', countingItemController.count);

// Recontar item
router.post('/items/:id/recount', countingItemController.recount);

// Aceitar contagem
router.post('/items/:id/accept', countingItemController.accept);

// Cancelar item
router.post('/items/:id/cancel', countingItemController.cancel);

// Itens pendentes do usuário
router.get('/items/pending/me', countingItemController.getPendingByUser);

// Estatísticas de produto
router.get('/products/:productId/stats', countingItemController.getProductStats);

export default router;
