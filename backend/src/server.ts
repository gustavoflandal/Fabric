import { app } from './app';
import { config } from './config/env';
import { logger } from './config/logger';
import { prisma } from './config/database';
import { initializeEventListeners } from './events/listeners';
import notificationScheduler from './services/notification-scheduler.service';
import logCleanupJob from './jobs/log-cleanup.job';
import stockPositionReconciliationJob from './jobs/stock-position-reconciliation.job';
import { loadLicensedModules } from './services/licensed-module.service';

const startServer = async () => {
  try {
    // Test database connection
    await prisma.$connect();
    logger.info('✅ Database connected successfully');

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
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  notificationScheduler.stop();
  logCleanupJob.stop();
  stockPositionReconciliationJob.stop();
  await prisma.$disconnect();
  process.exit(0);
});

startServer();
