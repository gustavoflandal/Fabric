/**
 * Job da Manutenção (Fase 4). Duas responsabilidades na mesma execução
 * diária, mesmo padrão de `lot-expiry.job.ts` (arquivo próprio, não o
 * NotificationSchedulerService do núcleo, porque MANUTENCAO é módulo
 * licenciável):
 *
 *   1. gerar ordens preventivas a partir de MaintenancePlan vencidos;
 *   2. detectar ordens de manutenção atrasadas e notificar.
 *
 * PERIODICIDADE — uma vez por dia, às 6h (`0 6 * * *`): vencimento de plano é
 * função da DATA, mesmo raciocínio de `lot-expiry.job.ts` — rodar mais
 * seguido não descobriria nada de novo entre uma execução e a seguinte.
 */
import cron from 'node-cron';
import { logger } from '../config/logger';
import { prisma } from '../config/database';
import { isModuleEnabled } from '../services/licensed-module.service';
import maintenanceOrderService from '../services/maintenance-order.service';
import notificationDetector from '../services/notification-detector.service';

export class MaintenanceJob {
  private job: ReturnType<typeof cron.schedule> | null = null;

  start() {
    this.job = cron.schedule('0 6 * * *', async () => {
      await this.run();
    });

    logger.info('✅ Job de manutenção iniciado (diariamente às 6h)');
  }

  stop() {
    if (this.job) {
      this.job.stop();
      this.job = null;
      logger.info('🛑 Job de manutenção parado');
    }
  }

  async run() {
    try {
      if (!(await isModuleEnabled('MANUTENCAO'))) {
        return;
      }

      await this.generateDuePreventiveOrders();
      await notificationDetector.detectOverdueMaintenance();
    } catch (error) {
      logger.error('❌ Erro no job de manutenção:', error);
    }
  }

  private async generateDuePreventiveOrders() {
    const now = new Date();
    const duePlans = await prisma.maintenancePlan.findMany({
      where: { active: true, nextDueDate: { lte: now } },
    });

    let generated = 0;
    for (const plan of duePlans) {
      const alreadyOpen = await maintenanceOrderService.hasOpenOrderForPlan(plan.id);
      if (alreadyOpen) {
        continue;
      }

      await maintenanceOrderService.createPreventiveFromPlan(plan.id);

      // Avança a partir do nextDueDate ANTERIOR, não de `now()` — calendário
      // fixo, não relativo à execução (evita acumular atraso silencioso a
      // cada execução perdida do job).
      const newNextDueDate = new Date(plan.nextDueDate.getTime() + plan.frequencyDays * 24 * 60 * 60 * 1000);
      await prisma.maintenancePlan.update({
        where: { id: plan.id },
        data: { nextDueDate: newNextDueDate },
      });

      generated += 1;
    }

    if (generated > 0) {
      logger.info(`🔧 Manutenção: ${generated} ordem(ns) preventiva(s) gerada(s)`);
    }
  }

  /** Execução manual (testes e apuração sob demanda). */
  async runManually() {
    logger.info('🔧 Executando job de manutenção manualmente...');
    return this.run();
  }
}

export default new MaintenanceJob();
