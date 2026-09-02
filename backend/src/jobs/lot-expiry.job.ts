/**
 * Job de Validade de Lote (Fase 5 do plano do WMS —
 * docs/fase-2026-09-modernizacao/WMS_IMPLEMENTATION_ANALYSIS.md, seção 5;
 * seção 3.4 de 04_ARQUITETURA_MODULAR_LICENCIAMENTO.md).
 *
 * Varre os lotes com `expiresAt` dentro da janela de alerta (ou já no passado)
 * que AINDA têm saldo em alguma posição, e notifica os gestores (categoria
 * `WAREHOUSE`): `LOT_EXPIRING_SOON` (WARNING, prioridade 3) e `LOT_EXPIRED`
 * (ERROR, prioridade 4).
 *
 * POR QUE UM JOB PRÓPRIO, e não um sexto `cron.schedule` em
 * `notification-scheduler.service.ts`: o mesmo argumento de
 * `replenishment.job.ts` e `stock-position-reconciliation.job.ts`, e aqui ele é
 * ainda mais direto — aquele scheduler é do NÚCLEO PCP. Ele não importa
 * `isModuleEnabled` em lugar nenhum, não tem nenhum job condicionado a licença,
 * e loga com `console.log` em vez do `logger` do winston. Enfiar ali um job que
 * só existe com WMS licenciado faria o agendador do núcleo passar a conhecer
 * módulo opcional, que é exatamente a dependência que a seção 3.4 do documento
 * de licenciamento manda evitar. Os três jobs WMS ficam onde os outros dois já
 * estão: arquivo próprio, `isModuleEnabled('WMS')` na entrada, `runManually()`.
 *
 * PERIODICIDADE — UMA VEZ POR DIA, às 6h (`0 6 * * *`):
 *   * validade é uma função da DATA. Entre uma execução e a seguinte, o único
 *     evento possível é a virada do dia; rodar de hora em hora produziria 24
 *     varreduras para descobrir a mesma coisa 24 vezes (e o dedupe de 24h de
 *     `checkExpiringLots()` descartaria 23 delas de qualquer forma).
 *   * 6h, e não 8h ou meio-dia: é o início da janela do job de reposição
 *     (`*\/30 6-22`), ou seja, o horário em que o armazém abre nesta instalação.
 *     O alerta já está no sino quando o primeiro turno chega, que é quando dá
 *     para agir sobre ele.
 *   * fora do horário do resumo diário das 8h de propósito: aquele resumo conta
 *     as notificações NÃO LIDAS do dia CIVIL ANTERIOR, então um lote alertado
 *     hoje às 6h só entra no resumo de amanhã — o que é o comportamento certo
 *     (o resumo é a segunda chance de quem não leu, não uma duplicata imediata).
 */

import cron from 'node-cron';
import { logger } from '../config/logger';
import { config } from '../config/env';
import notificationDetector from '../services/notification-detector.service';
import { isModuleEnabled } from '../services/licensed-module.service';

export class LotExpiryJob {
  // `ReturnType<typeof cron.schedule>` pelo mesmo motivo documentado em
  // `stock-position-reconciliation.job.ts` e `replenishment.job.ts`:
  // `cron.ScheduledTask` não existe no espaço de TIPOS na versão instalada do
  // node-cron e geraria um TS2503.
  private job: ReturnType<typeof cron.schedule> | null = null;

  start() {
    this.job = cron.schedule('0 6 * * *', async () => {
      await this.run();
    });

    logger.info(
      `✅ Job de validade de lote iniciado (diariamente às 6h, janela de alerta ` +
        `de ${config.wms.lotExpiryAlertDays} dia(s))`
    );
  }

  stop() {
    if (this.job) {
      this.job.stop();
      this.job = null;
      logger.info('🛑 Job de validade de lote parado');
    }
  }

  /**
   * Executa a verificação. A checagem de licença aparece DUAS vezes (aqui e no
   * detector) pelo mesmo motivo dos outros jobs WMS: aqui ela evita o log e a
   * chamada; no detector ela é a garantia real, porque o detector também é
   * chamável por fora do job.
   */
  async run() {
    try {
      if (!(await isModuleEnabled('WMS'))) {
        return [];
      }

      const findings = await notificationDetector.checkExpiringLots();

      if (findings.length === 0) {
        return findings;
      }

      const expired = findings.filter((f) => f.status === 'EXPIRED');
      const expiring = findings.filter((f) => f.status === 'EXPIRING_SOON');

      logger.info(
        `🗓️ Validade de lote: ${expired.length} lote(s) VENCIDO(S) com saldo, ` +
          `${expiring.length} a vencer em até ${config.wms.lotExpiryAlertDays} dia(s)`
      );

      // `error`, e não `warn`: lote vencido com saldo é estoque INUTILIZÁVEL que
      // o saldo agregado ainda conta como disponível para o MRP — é um estado
      // errado do armazém, não um problema de planejamento como o `NO_SOURCE` da
      // reposição. Sobe no mesmo nível da divergência de saldo do job de
      // reconciliação, e pela mesma razão: enquanto ninguém agir, o sistema está
      // respondendo errado sobre o que tem em estoque.
      for (const finding of expired) {
        logger.error(
          `   VENCIDO: lote ${finding.lotNumber} de ${finding.productCode} — ` +
            `${finding.totalQuantity} em ${finding.positions
              .map((p) => p.positionCode)
              .join(', ')} (venceu ${finding.expiresAt.toLocaleDateString('pt-BR')})`
        );
      }

      return findings;
    } catch (error) {
      logger.error('❌ Erro na verificação de validade de lote:', error);
      return [];
    }
  }

  /** Execução manual (testes e apuração sob demanda). */
  async runManually() {
    logger.info('🔧 Executando verificação manual de validade de lote...');
    return this.run();
  }
}

export default new LotExpiryJob();
