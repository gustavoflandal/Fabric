import cron from 'node-cron';
import notificationDetector from './notification-detector.service';
import notificationService from './notification.service';

/**
 * Serviço responsável por agendar verificações automáticas de notificações
 */
export class NotificationSchedulerService {
  private jobs: cron.ScheduledTask[] = [];

  /**
   * Iniciar todos os cron jobs
   */
  start() {
    console.log('[NotificationScheduler] Iniciando agendamentos...');

    // A cada 5 minutos - Verificar ordens atrasadas e gargalos
    const job1 = cron.schedule('*/5 * * * *', async () => {
      console.log('[NotificationScheduler] Verificando ordens atrasadas e gargalos...');
      try {
        await Promise.all([
          notificationDetector.detectProductionDelays(),
          notificationDetector.detectBottlenecks(),
        ]);
      } catch (error) {
        console.error('[NotificationScheduler] Erro ao verificar produção:', error);
      }
    });

    // A cada 15 minutos - Verificar estoque baixo
    const job2 = cron.schedule('*/15 * * * *', async () => {
      console.log('[NotificationScheduler] Verificando níveis de estoque...');
      try {
        await notificationDetector.checkLowStock();
      } catch (error) {
        console.error('[NotificationScheduler] Erro ao verificar estoque:', error);
      }
    });

    // Diariamente às 8h - Resumo do dia anterior para os gestores
    const job3 = cron.schedule('0 8 * * *', async () => {
      console.log('[NotificationScheduler] Gerando resumo diário...');
      try {
        const sent = await notificationDetector.sendDailySummary();
        console.log(`[NotificationScheduler] Resumo diário enviado para ${sent} gestor(es)`);
      } catch (error) {
        console.error('[NotificationScheduler] Erro ao gerar resumo:', error);
      }
    });

    // A cada 1 hora - Limpar notificações antigas (30 dias)
    const job4 = cron.schedule('0 * * * *', async () => {
      console.log('[NotificationScheduler] Limpando notificações antigas...');
      try {
        const deleted = await notificationService.cleanupExpired(30);
        console.log(`[NotificationScheduler] ${deleted} notificações antigas removidas`);
      } catch (error) {
        console.error('[NotificationScheduler] Erro ao limpar notificações:', error);
      }
    });

    // A cada 2 horas - Centros produzindo abaixo da capacidade esperada
    const job5 = cron.schedule('0 */2 * * *', async () => {
      console.log('[NotificationScheduler] Verificando capacidade dos centros...');
      try {
        const detected = await notificationDetector.detectLowCapacity();
        console.log(`[NotificationScheduler] ${detected} centro(s) abaixo da capacidade esperada`);
      } catch (error) {
        console.error('[NotificationScheduler] Erro ao verificar capacidade:', error);
      }
    });

    this.jobs = [job1, job2, job3, job4, job5];

    console.log('[NotificationScheduler] ✅ 5 agendamentos iniciados:');
    console.log('  - A cada 5 min: Ordens atrasadas e gargalos');
    console.log('  - A cada 15 min: Níveis de estoque');
    console.log('  - Diariamente às 8h: Resumo do dia anterior (gestores)');
    console.log('  - A cada 1 hora: Limpeza de notificações antigas');
    console.log('  - A cada 2 horas: Capacidade ociosa dos centros');
  }

  /**
   * Parar todos os cron jobs
   */
  stop() {
    console.log('[NotificationScheduler] Parando agendamentos...');
    this.jobs.forEach(job => job.stop());
    this.jobs = [];
    console.log('[NotificationScheduler] ✅ Agendamentos parados');
  }

  /**
   * Executar verificação manual imediata
   */
  async runManualCheck() {
    console.log('[NotificationScheduler] Executando verificação manual...');
    
    try {
      await Promise.all([
        notificationDetector.detectProductionDelays(),
        notificationDetector.detectBottlenecks(),
        notificationDetector.checkLowStock(),
        notificationDetector.detectLowCapacity(),
      ]);
      
      console.log('[NotificationScheduler] ✅ Verificação manual concluída');
    } catch (error) {
      console.error('[NotificationScheduler] Erro na verificação manual:', error);
      throw error;
    }
  }
}

export default new NotificationSchedulerService();
