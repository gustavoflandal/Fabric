/**
 * Event Listeners - Ações Automáticas
 * Registra listeners para eventos do sistema
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
      // Criar registro de alerta de qualidade
      await prisma.auditLog.create({
        data: {
          userId: 'system',
          action: 'QUALITY_ALERT',
          resource: 'production_pointing',
          resourceId: data.pointingId,
          details: JSON.stringify({
            type: 'HIGH_SCRAP',
            scrapRate: data.scrapRate,
            threshold: data.threshold,
            productionOrderId: data.productionOrderId,
          }),
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
      await prisma.auditLog.create({
        data: {
          userId: 'system',
          action: 'SYSTEM_ERROR',
          resource: data.type || 'unknown',
          resourceId: data.receiptId || data.pointingId || data.orderId || 'unknown',
          details: JSON.stringify(data),
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
