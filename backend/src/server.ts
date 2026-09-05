import { app } from './app';
import { config } from './config/env';
import { logger } from './config/logger';
import { prisma } from './config/database';
import { initializeEventListeners } from './events/listeners';
import notificationScheduler from './services/notification-scheduler.service';
import logCleanupJob from './jobs/log-cleanup.job';
import stockPositionReconciliationJob from './jobs/stock-position-reconciliation.job';
import replenishmentJob from './jobs/replenishment.job';
import lotExpiryJob from './jobs/lot-expiry.job';
import { loadLicensedModules } from './services/licensed-module.service';
import { getSetting } from './services/system-setting.service';
import { generalLimiter, authLimiter, writeLimiter } from './middleware/rate-limit.middleware';

const startServer = async () => {
  try {
    // Test database connection
    await prisma.$connect();
    logger.info('✅ Database connected successfully');

    // Configurações do Sistema — rate-limiting só aplica os valores do banco
    // no PRÓXIMO restart (os limitadores já foram criados no import estático
    // de app.ts, antes desta linha rodar; .configure() ajusta o estado em uso
    // sem recriar o middleware nem perder os contadores por IP já em curso —
    // ver rate-limit.middleware.ts). Fallback = os valores hardcoded de hoje,
    // então nada muda até um admin editar pela tela e reiniciar o serviço.
    const [
      generalWindowMs, generalMax,
      loginWindowMs, loginMax,
      strictWindowMs, strictMax,
    ] = await Promise.all([
      getSetting('rate_limit.general.window_ms', 15 * 60 * 1000),
      getSetting('rate_limit.general.max_requests', config.nodeEnv === 'development' ? 1000 : 100),
      getSetting('rate_limit.login.window_ms', 15 * 60 * 1000),
      getSetting('rate_limit.login.max_requests', config.nodeEnv === 'development' || config.nodeEnv === 'test' ? 50 : 10),
      getSetting('rate_limit.strict.window_ms', 1 * 60 * 1000),
      getSetting('rate_limit.strict.max_requests', config.nodeEnv === 'development' ? 100 : 30),
    ]);
    generalLimiter.configure({ windowMs: generalWindowMs, max: generalMax });
    authLimiter.configure({ windowMs: loginWindowMs, max: loginMax });
    writeLimiter.configure({ windowMs: strictWindowMs, max: strictMax });
    logger.info('✅ Rate limiting configurado a partir das Configurações do Sistema');

    // F0.8: módulos licenciados desta instalação, lidos UMA vez e cacheados em
    // memória (uma instalação não muda de licença a cada request). O middleware
    // requireModule() também sabe carregar sob demanda, então isto é
    // aquecimento de cache, não um passo obrigatório do boot.
    const licensedModules = await loadLicensedModules();
    logger.info(
      `✅ Módulos licenciados: ${[...licensedModules.entries()]
        .map(([code, enabled]) => `${code}=${enabled ? 'on' : 'off'}`)
        .join(', ')}`
    );

    // Initialize event listeners
    initializeEventListeners();
    logger.info('✅ Event listeners initialized');

    // Initialize notification scheduler
    notificationScheduler.start();
    logger.info('✅ Notification scheduler initialized');

    // Initialize log cleanup job
    logCleanupJob.start();
    logger.info('✅ Log cleanup job initialized');

    // F1.3: reconciliação diária do saldo por posição contra o saldo agregado.
    // O próprio job sai cedo quando o WMS não está licenciado nesta instalação.
    stockPositionReconciliationJob.start();

    // F4.10: reposição da área de picking a partir do pulmão. Mesmo padrão do
    // job acima — sai cedo sem WMS licenciado.
    replenishmentJob.start();

    // Fase 5: alerta de validade de lote (a vencer e já vencido com saldo).
    // Mesmo padrão dos dois jobs acima — sai cedo sem WMS licenciado.
    lotExpiryJob.start();

    // Start server
    app.listen(config.port, () => {
      logger.info(`🚀 Server running on port ${config.port}`);
      logger.info(`📝 Environment: ${config.nodeEnv}`);
      logger.info(`🔗 Health check: http://localhost:${config.port}/health`);
    });
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  notificationScheduler.stop();
  logCleanupJob.stop();
  stockPositionReconciliationJob.stop();
  replenishmentJob.stop();
  lotExpiryJob.stop();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  notificationScheduler.stop();
  logCleanupJob.stop();
  stockPositionReconciliationJob.stop();
  replenishmentJob.stop();
  lotExpiryJob.stop();
  await prisma.$disconnect();
  process.exit(0);
});

startServer();
