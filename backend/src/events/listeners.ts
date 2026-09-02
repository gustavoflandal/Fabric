/**
 * Event Listeners - Ações Automáticas
 * Registra listeners para eventos do sistema
 *
 * ✅ Fase 5 item 5.5 do cronograma (docs/fase-2026-09-modernizacao/
 * 02_CRONOGRAMA_IMPLEMENTACOES.md): decisão registrada sobre esta
 * infraestrutura, que tinha 15 listeners registrados, a maioria só
 * `console.log`/`console.warn`/`console.error` com comentários "TODO: ações
 * automáticas" nunca implementadas.
 *
 * Decisão: MANTER a infraestrutura como está (log estruturado + os 2
 * listeners que gravam em audit_logs, agora corrigidos - ver abaixo), sem
 * expandir os TODOs para virar notificações de verdade. Motivo: o sistema já
 * tem um caminho de notificação real e funcionando
 * (notification-detector.service.ts + notification.service.ts, chamados
 * DIRETAMENTE pelos services - ex: monitorScrapRate, checkLowStock), não
 * através deste event bus. Construir os TODOs aqui criaria um SEGUNDO
 * caminho de notificação para os mesmos eventos, arriscando duplicação
 * (o usuário recebendo o mesmo alerta duas vezes) sem nenhum ganho - não é
 * proposital, não veio de nenhum pedido de negócio, só listeners que
 * ficaram pela metade. Se um evento aqui precisar de uma ação real no
 * futuro, o caminho recomendado é integrar com notification.service.ts
 * (createBulk) em vez de reinventar a entrega de notificação aqui.
 *
 * Bug real encontrado e corrigido nesta revisão: os listeners de
 * QUALITY_SCRAP_HIGH e SYSTEM_ERROR tentavam gravar em `prisma.auditLog`
 * usando um campo `details` que nunca existiu no schema, e `userId: 'system'`,
 * que violava a FK (userId só aceita um id real de users ou null) - as duas
 * chamadas sempre falhavam silenciosamente (o try/catch engolia o erro).
 * Corrigido para usar os campos reais (description/newValues/errorMessage)
 * e omitir userId. Testado ao vivo: os dois agora gravam a linha
 * corretamente.
 */

import { eventBus, SystemEvents } from './event-bus';
import { prisma } from '../config/database';

/**
 * Inicializa todos os listeners do sistema
 */
export function initializeEventListeners() {
  console.log('[EventListeners] Inicializando listeners...');

  // ============================================
  // PRODUÇÃO
  // ============================================

  // Quando OP é concluída
  eventBus.on(SystemEvents.PRODUCTION_ORDER_COMPLETED, async (data: any) => {
    console.log(`[EventListener] OP ${data.productionOrderId} concluída`);
    
    // TODO: Aqui podem ser adicionadas ações como:
    // - Enviar notificação
    // - Criar entrada de estoque do produto acabado
    // - Gerar relatório de produção
    // - Atualizar dashboard
  });

  // Quando operação é iniciada
  eventBus.on(SystemEvents.PRODUCTION_OPERATION_STARTED, async (data: any) => {
    console.log(`[EventListener] Operação ${data.operationId} iniciada`);
  });

  // Quando operação é concluída
  eventBus.on(SystemEvents.PRODUCTION_OPERATION_COMPLETED, async (data: any) => {
    console.log(`[EventListener] Operação ${data.operationId} concluída`);
  });

  // Quando apontamento é criado
  eventBus.on(SystemEvents.PRODUCTION_POINTING_CREATED, async (data: any) => {
    console.log(
      `[EventListener] Apontamento criado: ${data.goodQuantity} un. ` +
      `(refugo: ${data.scrapQuantity || 0})`
    );
  });

  // ============================================
  // ESTOQUE
  // ============================================

  // Quando movimentação de estoque é criada
  eventBus.on(SystemEvents.STOCK_MOVEMENT_CREATED, async (data: any) => {
    console.log(
      `[EventListener] Movimentação de estoque: ${data.type} - ` +
      `Produto: ${data.productId}, Qtd: ${data.quantity}`
    );
  });

  // Quando estoque está baixo
  eventBus.on(SystemEvents.STOCK_LEVEL_LOW, async (data: any) => {
    console.warn(
      `⚠️  [EventListener] ESTOQUE BAIXO: ${data.productCode} - ${data.productName}\n` +
      `    Atual: ${data.currentQty}, Mínimo: ${data.minStock}`
    );
    
    // TODO: Ações automáticas:
    // - Enviar email para comprador
    // - Criar sugestão de compra
    // - Registrar alerta no dashboard
  });

  // Quando estoque está crítico
  eventBus.on(SystemEvents.STOCK_LEVEL_CRITICAL, async (data: any) => {
    console.error(
      `🚨 [EventListener] ESTOQUE CRÍTICO: ${data.productCode} - ${data.productName}\n` +
      `    Atual: ${data.currentQty}, Segurança: ${data.safetyStock}`
    );
    
    // TODO: Ações automáticas:
    // - Enviar alerta urgente
    // - Criar pedido de compra emergencial
    // - Notificar gerência
    // - Bloquear novas OPs do produto
  });

  // Quando estoque está em excesso
  eventBus.on(SystemEvents.STOCK_LEVEL_EXCESS, async (data: any) => {
    console.warn(
      `📦 [EventListener] ESTOQUE EM EXCESSO: ${data.productCode} - ${data.productName}\n` +
      `    Atual: ${data.currentQty}, Máximo: ${data.maxStock}`
    );
    
    // TODO: Ações automáticas:
    // - Sugerir promoção
    // - Alertar sobre custo de armazenagem
    // - Revisar planejamento
  });

  // ============================================
  // COMPRAS
  // ============================================

  // Quando orçamento é aprovado
  eventBus.on(SystemEvents.PURCHASE_QUOTATION_APPROVED, async (data: any) => {
    console.log(`[EventListener] Orçamento ${data.quotationNumber} aprovado`);
  });

  // Quando pedido é confirmado
  eventBus.on(SystemEvents.PURCHASE_ORDER_CONFIRMED, async (data: any) => {
    console.log(`[EventListener] Pedido ${data.orderNumber} confirmado`);
  });

  // Quando pedido é recebido
  eventBus.on(SystemEvents.PURCHASE_ORDER_RECEIVED, async (data: any) => {
    console.log(
      `[EventListener] Recebimento registrado: ${data.receiptNumber}\n` +
      `    Pedido: ${data.orderNumber}, Itens: ${data.itemsCount}`
    );
    
    // TODO: Ações automáticas:
    // - Enviar email de confirmação
    // - Atualizar previsões de MRP
    // - Liberar OPs que aguardavam material
  });

  // ============================================
  // QUALIDADE
  // ============================================

  // Quando refugo está alto
  eventBus.on(SystemEvents.QUALITY_SCRAP_HIGH, async (data: any) => {
    console.warn(
      `⚠️  [EventListener] REFUGO ALTO detectado!\n` +
      `    Apontamento: ${data.pointingId}\n` +
      `    OP: ${data.productionOrderId}\n` +
      `    Taxa de refugo: ${data.scrapRate.toFixed(2)}% (limite: ${data.threshold}%)`
    );
    
    // TODO: Ações automáticas:
    // - Criar alerta de qualidade
    // - Notificar supervisor
    // - Registrar não conformidade
    // - Sugerir análise de causa raiz
    
    try {
      // ✅ Fase 5 item 5.5 do cronograma: gravava em `details`, campo que
      // nunca existiu em AuditLog (schema.prisma so tem requestBody/
      // responseBody/oldValues/newValues/errorMessage), e `userId: 'system'`
      // violava a FK (userId so aceita um id real de users ou null) - essa
      // chamada sempre falhava e o alerta de qualidade nunca era
      // registrado de verdade, so o catch abaixo silenciava o erro.
      await prisma.auditLog.create({
        data: {
          action: 'QUALITY_ALERT',
          resource: 'production_pointing',
          resourceId: data.pointingId,
          description: `Refugo alto: ${data.scrapRate?.toFixed?.(2) ?? data.scrapRate}% (limite: ${data.threshold}%)`,
          newValues: {
            type: 'HIGH_SCRAP',
            scrapRate: data.scrapRate,
            threshold: data.threshold,
            productionOrderId: data.productionOrderId,
          },
        },
      });
    } catch (error) {
      console.error('[EventListener] Erro ao criar alerta de qualidade:', error);
    }
  });

  // ============================================
  // MRP
  // ============================================

  // Quando MRP é executado
  eventBus.on(SystemEvents.MRP_EXECUTED, async (data: any) => {
    console.log(`[EventListener] MRP executado para OP ${data.orderId}`);
  });

  // ============================================
  // SISTEMA
  // ============================================

  // Quando ocorre erro
  eventBus.on(SystemEvents.SYSTEM_ERROR, async (data: any) => {
    console.error(
      `❌ [EventListener] ERRO DO SISTEMA:\n` +
      `    Tipo: ${data.type}\n` +
      `    Mensagem: ${data.error}`
    );
    
    // TODO: Ações automáticas:
    // - Registrar em log de erros
    // - Enviar para sistema de monitoramento
    // - Notificar equipe técnica
    
    try {
      // ✅ Fase 5 item 5.5: mesmo problema do listener de qualidade acima
      // (campo `details` inexistente, `userId: 'system'` violando FK).
      await prisma.auditLog.create({
        data: {
          action: 'SYSTEM_ERROR',
          resource: data.type || 'unknown',
          resourceId: data.receiptId || data.pointingId || data.orderId || undefined,
          errorMessage: typeof data.error === 'string' ? data.error : JSON.stringify(data.error),
          newValues: data,
        },
      });
    } catch (error) {
      console.error('[EventListener] Erro ao registrar erro do sistema:', error);
    }
  });

  // Quando ocorre warning
  eventBus.on(SystemEvents.SYSTEM_WARNING, async (data: any) => {
    console.warn(
      `⚠️  [EventListener] AVISO DO SISTEMA:\n` +
      `    Tipo: ${data.type}\n` +
      `    Mensagem: ${data.error || 'N/A'}`
    );
  });

  console.log('[EventListeners] ✅ Listeners inicializados com sucesso!');
  console.log(`[EventListeners] Total de eventos registrados: ${eventBus.getEvents().length}`);
}

/**
 * Remove todos os listeners (útil para testes)
 */
export function removeAllEventListeners() {
  eventBus.removeAllListeners();
  console.log('[EventListeners] Todos os listeners removidos');
}

/**
 * Lista todos os eventos ativos
 */
export function listActiveEvents() {
  const events = eventBus.getEvents();
  console.log('[EventListeners] Eventos ativos:');
  events.forEach(event => {
    const count = eventBus.listenerCount(event);
    console.log(`  - ${event}: ${count} listener(s)`);
  });
  return events;
}
