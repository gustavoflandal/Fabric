import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import notificationController from '../controllers/notification.controller';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

/**
 * @route   GET /api/v1/notifications
 * @desc    Listar notificações do usuário
 * @access  Private
 */
router.get('/', notificationController.getAll);

/**
 * @route   GET /api/v1/notifications/critical
 * @desc    Buscar notificações críticas não lidas
 * @access  Private
 */
router.get('/critical', notificationController.getCritical);

/**
 * @route   GET /api/v1/notifications/count/unread
 * @desc    Contar notificações não lidas
 * @access  Private
 */
router.get('/count/unread', notificationController.countUnread);

/**
 * @route   GET /api/v1/notifications/count/priority
 * @desc    Contar notificações por prioridade
 * @access  Private
 */
router.get('/count/priority', notificationController.countByPriority);

/**
 * @route   GET /api/v1/notifications/metrics
 * @desc    Obter métricas de notificações
 * @access  Private
 */
router.get('/metrics', notificationController.getMetrics);

/**
 * @route   PATCH /api/v1/notifications/:id/read
 * @desc    Marcar notificação como lida
 * @access  Private
 */
router.patch('/:id/read', notificationController.markAsRead);

/**
 * @route   PATCH /api/v1/notifications/read-all
 * @desc    Marcar todas as notificações como lidas
 * @access  Private
 */
router.patch('/read-all', notificationController.markAllAsRead);

/**
 * @route   PATCH /api/v1/notifications/:id/archive
 * @desc    Arquivar notificação
 * @access  Private
 */
router.patch('/:id/archive', notificationController.archive);

export default router;
