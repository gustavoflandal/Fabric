import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

class CountingSchedulerService {
  /**
   * Processar planos agendados (executar diariamente)
   */
  async processScheduledPlans() {
    const today = new Date();
    
    // Buscar planos ativos com nextExecution <= hoje
    const plans = await prisma.countingPlan.findMany({
      where: {
        status: 'ACTIVE',
        nextExecution: {
          lte: today
        }
      }
    });
    
    for (const plan of plans) {
      // Criar nova sessão
      await this.createSession(plan);
      
      // Atualizar próxima execução
      await this.updateNextExecution(plan);
    }
  }

  /**
   * Criar sessão de contagem para o plano
   */
  private async createSession(plan: any) {
    // Lógica para criar sessão...
    const sessionCode = `SESS-${new Date().toISOString().slice(0,10)}-${plan.code}`;
    
    await prisma.countingSession.create({
      data: {
        code: sessionCode,
        planId: plan.id,
        scheduledDate: new Date(),
        status: 'SCHEDULED'
      }
    });
  }

  /**
   * Calcular e atualizar próxima execução
   */
  private async updateNextExecution(plan: any) {
    // Lógica baseada na frequência...
    let nextDate = new Date();
    
    switch (plan.frequency) {
      case 'DAILY':
        nextDate.setDate(nextDate.getDate() + 1);
        break;
      case 'WEEKLY':
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case 'BIWEEKLY':
        nextDate.setDate(nextDate.getDate() + 14);
        break;
      case 'MONTHLY':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case 'QUARTERLY':
        nextDate.setMonth(nextDate.getMonth() + 3);
        break;
      default:
        return;
    }
    
    await prisma.countingPlan.update({
      where: { id: plan.id },
      data: { nextExecution: nextDate }
    });
  }
}

export default new CountingSchedulerService();
