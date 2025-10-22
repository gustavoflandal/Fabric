/**
 * Job de Limpeza de Logs Antigos
 * Remove audit logs com mais de X dias para evitar crescimento descontrolado do banco
 */

import cron from 'node-cron';
import { prisma } from '../config/database';
import { logger } from '../config/logger';

export class LogCleanupJob {
  private job: cron.ScheduledTask | null = null;
  private readonly RETENTION_DAYS = 90; // Manter logs por 90 dias

  /**
   * Inicia o job de limpeza (executa diariamente às 2h da manhã)
   */
  start() {
    // Executar todo dia às 2h da manhã
    this.job = cron.schedule('0 2 * * *', async () => {
      await this.cleanup();
    });
    
    logger.info('✅ Job de limpeza de logs iniciado (execução diária às 2h)');
  }

  /**
   * Para o job de limpeza
   */
  stop() {
    if (this.job) {
      this.job.stop();
      this.job = null;
      logger.info('🛑 Job de limpeza de logs parado');
    }
  }

  /**
   * Executa a limpeza de logs antigos
   */
  async cleanup() {
    try {
      logger.info('🧹 Iniciando limpeza de logs antigos...');
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.RETENTION_DAYS);
      
      const result = await prisma.auditLog.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate
          }
        }
      });
      
      logger.info(`✅ ${result.count} logs antigos removidos (anteriores a ${cutoffDate.toISOString()})`);
      
      // Estatísticas pós-limpeza
      const remaining = await prisma.auditLog.count();
      logger.info(`📊 Logs remanescentes no sistema: ${remaining}`);
      
    } catch (error) {
      logger.error('❌ Erro na limpeza de logs:', error);
    }
  }

  /**
   * Executa limpeza manualmente (útil para testes)
   */
  async runManually() {
    logger.info('🔧 Executando limpeza manual de logs...');
    await this.cleanup();
  }

  /**
   * Retorna estatísticas de logs
   */
  async getStats() {
    const total = await prisma.auditLog.count();
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.RETENTION_DAYS);
    
    const toBeDeleted = await prisma.auditLog.count({
      where: {
        createdAt: {
          lt: cutoffDate
        }
      }
    });
    
    return {
      total,
      toBeDeleted,
      retentionDays: this.RETENTION_DAYS,
      cutoffDate
    };
  }
}

export default new LogCleanupJob();
