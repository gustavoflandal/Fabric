/**
 * Event Bus - Sistema de Eventos Centralizado
 * Permite comunicação assíncrona entre módulos
 */

type EventHandler = (...args: any[]) => void | Promise<void>;

interface EventSubscription {
  event: string;
  handler: EventHandler;
}

class EventBus {
  private listeners: Map<string, EventHandler[]> = new Map();
  private subscriptions: EventSubscription[] = [];

  /**
   * Registra um listener para um evento
   */
  on(event: string, handler: EventHandler): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }

    const handlers = this.listeners.get(event)!;
    handlers.push(handler);

    this.subscriptions.push({ event, handler });

    console.log(`[EventBus] Listener registrado: ${event}`);
  }

  /**
   * Remove um listener de um evento
   */
  off(event: string, handler: EventHandler): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;

    const index = handlers.indexOf(handler);
    if (index > -1) {
      handlers.splice(index, 1);
    }

    // Remover da lista de subscriptions
    const subIndex = this.subscriptions.findIndex(
      (sub) => sub.event === event && sub.handler === handler
    );
    if (subIndex > -1) {
      this.subscriptions.splice(subIndex, 1);
    }

    console.log(`[EventBus] Listener removido: ${event}`);
  }

  /**
   * Emite um evento para todos os listeners
   */
  async emit(event: string, data?: any): Promise<void> {
    const handlers = this.listeners.get(event);
    
    if (!handlers || handlers.length === 0) {
      console.log(`[EventBus] Nenhum listener para: ${event}`);
      return;
    }

    console.log(`[EventBus] Emitindo evento: ${event}`, data ? `(${JSON.stringify(data).substring(0, 100)}...)` : '');

    // Executar todos os handlers
    const promises = handlers.map(async (handler) => {
      try {
        await handler(data);
      } catch (error) {
        console.error(`[EventBus] Erro ao processar evento ${event}:`, error);
        // Não propaga o erro para não quebrar outros handlers
      }
    });

    await Promise.all(promises);
  }

  /**
   * Registra um listener que será executado apenas uma vez
   */
  once(event: string, handler: EventHandler): void {
    const onceHandler: EventHandler = async (...args) => {
      await handler(...args);
      this.off(event, onceHandler);
    };

    this.on(event, onceHandler);
  }

  /**
   * Remove todos os listeners de um evento
   */
  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
      this.subscriptions = this.subscriptions.filter((sub) => sub.event !== event);
      console.log(`[EventBus] Todos os listeners removidos de: ${event}`);
    } else {
      this.listeners.clear();
      this.subscriptions = [];
      console.log(`[EventBus] Todos os listeners removidos`);
    }
  }

  /**
   * Lista todos os eventos registrados
   */
  getEvents(): string[] {
    return Array.from(this.listeners.keys());
  }

  /**
   * Retorna o número de listeners para um evento
   */
  listenerCount(event: string): number {
    const handlers = this.listeners.get(event);
    return handlers ? handlers.length : 0;
  }

  /**
   * Retorna todas as subscriptions ativas
   */
  getSubscriptions(): EventSubscription[] {
    return [...this.subscriptions];
  }
}

// Singleton - instância única do Event Bus
export const eventBus = new EventBus();

// Tipos de eventos do sistema
export enum SystemEvents {
  // Produção
  PRODUCTION_POINTING_CREATED = 'production.pointing.created',
  PRODUCTION_POINTING_UPDATED = 'production.pointing.updated',
  PRODUCTION_POINTING_DELETED = 'production.pointing.deleted',
  PRODUCTION_POINTING_FINISHED = 'production.pointing.finished',
  
  PRODUCTION_ORDER_CREATED = 'production.order.created',
  PRODUCTION_ORDER_UPDATED = 'production.order.updated',
  PRODUCTION_ORDER_STARTED = 'production.order.started',
  PRODUCTION_ORDER_COMPLETED = 'production.order.completed',
  PRODUCTION_ORDER_CANCELLED = 'production.order.cancelled',
  
  PRODUCTION_OPERATION_STARTED = 'production.operation.started',
  PRODUCTION_OPERATION_COMPLETED = 'production.operation.completed',
  
  // Estoque
  STOCK_MOVEMENT_CREATED = 'stock.movement.created',
  STOCK_LEVEL_LOW = 'stock.level.low',
  STOCK_LEVEL_CRITICAL = 'stock.level.critical',
  STOCK_LEVEL_EXCESS = 'stock.level.excess',
  
  // Compras
  PURCHASE_QUOTATION_CREATED = 'purchase.quotation.created',
  PURCHASE_QUOTATION_APPROVED = 'purchase.quotation.approved',
  PURCHASE_QUOTATION_REJECTED = 'purchase.quotation.rejected',
  
  PURCHASE_ORDER_CREATED = 'purchase.order.created',
  PURCHASE_ORDER_APPROVED = 'purchase.order.approved',
  PURCHASE_ORDER_CONFIRMED = 'purchase.order.confirmed',
  PURCHASE_ORDER_RECEIVED = 'purchase.order.received',
  PURCHASE_ORDER_CANCELLED = 'purchase.order.cancelled',
  
  // MRP
  MRP_EXECUTED = 'mrp.executed',
  MRP_REQUIREMENT_CREATED = 'mrp.requirement.created',
  
  // Qualidade
  QUALITY_ALERT_CREATED = 'quality.alert.created',
  QUALITY_SCRAP_HIGH = 'quality.scrap.high',
  
  // Sistema
  SYSTEM_ERROR = 'system.error',
  SYSTEM_WARNING = 'system.warning',
}

export default eventBus;
