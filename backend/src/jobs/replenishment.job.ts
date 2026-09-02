/**
 * Job de Reposição de Área de Picking (F4.10 do plano do WMS —
 * docs/fase-2026-09-modernizacao/WMS_IMPLEMENTATION_ANALYSIS.md, seção 5,
 * Fase 4; seção 3.4 de 04_ARQUITETURA_MODULAR_LICENCIAMENTO.md).
 *
 * Varre as posições marcadas como área de picking, gera tarefa
 * `REPLENISHMENT` a partir do pulmão para as que caíram abaixo do mínimo e
 * notifica (categoria `WAREHOUSE`).
 *
 * POR QUE UM JOB PRÓPRIO, e não mais um `cron.schedule` dentro de
 * `notification-scheduler.service.ts` (que tem cinco): aquele service é um
 * agendador de NOTIFICAÇÃO, e três dos cinco jobs dele são placeholders vazios.
 * A reposição não é uma notificação — ela CRIA TRABALHO no armazém (linhas em
 * `warehouse_tasks`); a notificação é o efeito secundário. Misturá-la ali
 * esconderia isso. O precedente correto é `stock-position-reconciliation.job.ts`
 * (Fase 1): job WMS, arquivo próprio, `isModuleEnabled('WMS')` logo na entrada,
 * `runManually()` para teste e apuração sob demanda.
 *
 * PERIODICIDADE — a cada 30 minutos, em horário comercial estendido
 * (`*\/30 6-22 * * *`), e não de hora em hora nem a cada 5 minutos:
 *   * a reposição é uma resposta a consumo, e consumo só acontece com gente no
 *     armazém — varrer de madrugada gera zero tarefa e custa uma varredura;
 *   * 30 min é menor que o tempo típico entre a posição de picking cruzar o
 *     mínimo e ela zerar de fato, que é o que a reposição precisa evitar;
 *   * mais frequente que isso não geraria tarefa nova (o dedupe de
 *     `replenishment.service.ts` já barra enquanto houver reposição aberta),
 *     só varreduras.
 */

import cron from 'node-cron';
import { logger } from '../config/logger';
import notificationDetector from '../services/notification-detector.service';
import { isModuleEnabled } from '../services/licensed-module.service';

export class ReplenishmentJob {
  // `ReturnType<typeof cron.schedule>` pelo mesmo motivo documentado em
  // `stock-position-reconciliation.job.ts`: `cron.ScheduledTask` não existe no
  // espaço de TIPOS na versão instalada do node-cron e geraria um TS2503.
  private job: ReturnType<typeof cron.schedule> | null = null;

  start() {
    this.job = cron.schedule('*/30 6-22 * * *', async () => {
      await this.run();
    });

    logger.info(
      '✅ Job de reposição de área de picking iniciado (a cada 30 min, das 6h às 22h)'
    );
  }

  stop() {
    if (this.job) {
      this.job.stop();
      this.job = null;
      logger.info('🛑 Job de reposição de área de picking parado');
    }
  }

  /**
   * Executa a verificação. A checagem de licença aparece DUAS vezes (aqui e no
   * detector) de propósito: aqui ela evita o log e a chamada; no detector ela é
   * a garantia real, porque o detector também é chamável por fora do job. É a
   * mesma redundância barata de `stock-position-reconciliation.job.ts`.
   */
  async run() {
    try {
      if (!(await isModuleEnabled('WMS'))) {
        return [];
      }

      const needs = await notificationDetector.checkReplenishmentNeeded();

      if (needs.length === 0) {
        return needs;
      }

      const created = needs.filter((n) => n.status === 'TASK_CREATED').length;
      const noSource = needs.filter((n) => n.status === 'NO_SOURCE').length;

      logger.info(
        `📦 Reposição: ${needs.length} posição(ões) de picking abaixo do mínimo — ` +
          `${created} tarefa(s) gerada(s), ${noSource} sem saldo no pulmão`
      );

      // `warn`, não `error`: posição de picking sem pulmão para repor é um
      // problema de PLANEJAMENTO (faltou comprar/produzir), não um estado
      // inconsistente do sistema — diferente da divergência de saldo do job de
      // reconciliação, que sobe como `error` porque indica bug.
      for (const need of needs.filter((n) => n.status === 'NO_SOURCE')) {
        logger.warn(
          `   ${need.productCode} em ${need.pickingPositionCode}: ` +
            `${need.currentQuantity} (mínimo ${need.threshold}) e nenhum saldo no pulmão`
        );
      }

      return needs;
    } catch (error) {
      logger.error('❌ Erro na verificação de reposição de picking:', error);
      return [];
    }
  }

  /** Execução manual (testes e apuração sob demanda). */
  async runManually() {
    logger.info('🔧 Executando verificação manual de reposição...');
    return this.run();
  }
}

export default new ReplenishmentJob();
