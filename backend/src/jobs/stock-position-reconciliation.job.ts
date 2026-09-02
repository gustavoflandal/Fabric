/**
 * Job de Reconciliação do Saldo por Posição (F1.3 do plano do WMS —
 * docs/fase-2026-09-modernizacao/WMS_IMPLEMENTATION_ANALYSIS.md, seção 5).
 *
 * Verifica, por produto, a invariante
 *
 *     SUM(stock_position_balances.quantity) <= stock_balances.quantity
 *
 * `<=`, e não `==`, nesta fase: nenhum fluxo de produção informa posição ainda
 * (recebimento, contagem, reserva de produção e as entradas/saídas manuais
 * chamam `applyMovement` sem `positionId`), então o normal é o agregado ser
 * MAIOR que a soma endereçada. Essa diferença é saldo legítimo NÃO ENDEREÇADO e
 * vai encolhendo conforme as fases 2 a 4 conectam cada fluxo ao endereço. A
 * divergência real é o outro lado — mais material endereçado do que existe no
 * produto — que só pode vir de escrita fora de `stock.service.ts::applyMovement()`.
 *
 * O job apenas REPORTA (log). Não corrige nada de propósito: uma correção
 * automática sobre um estado que já é inconsistente escolheria arbitrariamente
 * qual dos dois lados é a verdade e destruiria a evidência do bug que a causou.
 * A apuração é humana, com o mesmo dado exposto em
 * `GET /stock-positions/divergences`.
 */

import cron from 'node-cron';
import { logger } from '../config/logger';
import { getDivergences } from '../services/stock-position.service';
import { isModuleEnabled } from '../services/licensed-module.service';

export class StockPositionReconciliationJob {
  // `ReturnType<typeof cron.schedule>` em vez de `cron.ScheduledTask`, que é o
  // que `log-cleanup.job.ts` usa: com a versão instalada do node-cron, o
  // namespace `cron` não existe no espaço de TIPOS, e escrever
  // `cron.ScheduledTask` gera um TS2503 (um dos ~67 erros pré-existentes de
  // `tsc --noEmit`). Não faz sentido um arquivo novo nascer somando a essa
  // dívida; o tipo aqui é exatamente o mesmo, derivado da própria função.
  private job: ReturnType<typeof cron.schedule> | null = null;

  /**
   * Inicia o job (diariamente às 3h da manhã).
   *
   * 3h, e não 2h, para não concorrer com o job de limpeza de logs
   * (`log-cleanup.job.ts`, `0 2 * * *`) — os dois varrem tabelas grandes e não
   * há motivo para empilhá-los na mesma janela.
   */
  start() {
    this.job = cron.schedule('0 3 * * *', async () => {
      await this.reconcile();
    });

    logger.info('✅ Job de reconciliação de saldo por posição iniciado (execução diária às 3h)');
  }

  stop() {
    if (this.job) {
      this.job.stop();
      this.job = null;
      logger.info('🛑 Job de reconciliação de saldo por posição parado');
    }
  }

  /**
   * Executa a verificação. Retorna as divergências encontradas para que
   * `runManually()` e os testes possam inspecionar o resultado, além do log.
   */
  async reconcile() {
    try {
      // Instalação sem WMS licenciado não tem saldo por posição para
      // reconciliar — a tabela existe (a migration é aditiva) e está vazia.
      // Sair cedo evita uma varredura diária inútil.
      if (!(await isModuleEnabled('WMS'))) {
        return [];
      }

      logger.info('🔎 Iniciando reconciliação de saldo por posição...');

      const divergences = await getDivergences();

      if (divergences.length === 0) {
        logger.info('✅ Saldo por posição consistente com o saldo agregado');
        return divergences;
      }

      // `error`, não `warn`: soma endereçada acima do agregado não é um estado
      // tolerável do sistema, é sintoma de escrita de saldo fora da transação
      // com lock. Precisa aparecer no mesmo nível de um erro de aplicação.
      logger.error(
        `❌ ${divergences.length} produto(s) com saldo por posição MAIOR que o saldo agregado ` +
          '(invariante F1.3 violada - houve escrita de saldo fora de applyMovement?)'
      );

      for (const divergence of divergences) {
        logger.error(
          `   ${divergence.productCode} (${divergence.productName}): ` +
            `endereçado ${divergence.addressedQuantity}, agregado ${divergence.aggregateQuantity}, ` +
            `excesso ${divergence.difference}`
        );
      }

      return divergences;
    } catch (error) {
      logger.error('❌ Erro na reconciliação de saldo por posição:', error);
      return [];
    }
  }

  /** Execução manual (útil para testes e para apuração sob demanda). */
  async runManually() {
    logger.info('🔧 Executando reconciliação manual de saldo por posição...');
    return this.reconcile();
  }
}

export default new StockPositionReconciliationJob();
