import { prisma } from '../config/database';
import stockService from './stock.service';
import { eventBus, SystemEvents } from '../events/event-bus';

export interface CreatePurchaseReceiptDto {
  purchaseOrderId: string;
  receiptDate: string;
  invoiceNumber?: string;
  notes?: string;
  items: {
    orderItemId: string;
    productId: string;
    quantityReceived: number;
    notes?: string;
  }[];
}

export class PurchaseReceiptService {
  /**
   * Registra recebimento de pedido de compra
   */
  async create(data: CreatePurchaseReceiptDto, userId: string) {
    // Buscar pedido
    const order = await prisma.purchaseOrder.findUnique({
      where: { id: data.purchaseOrderId },
      include: {
        items: true,
        supplier: true,
      },
    });

    if (!order) {
      throw new Error('Pedido de compra não encontrado');
    }

    if (order.status === 'CANCELLED') {
      throw new Error('Não é possível receber pedido cancelado');
    }

    // Validar itens
    for (const item of data.items) {
      const orderItem = order.items.find(oi => oi.id === item.orderItemId);
      
      if (!orderItem) {
        throw new Error(`Item ${item.orderItemId} não encontrado no pedido`);
      }

      const totalReceived = orderItem.receivedQty + item.quantityReceived;
      
      if (totalReceived > orderItem.quantity) {
        throw new Error(
          `Quantidade recebida (${totalReceived}) excede quantidade pedida (${orderItem.quantity}) ` +
          `para o produto ${item.productId}`
        );
      }
    }

    // Gerar número do recebimento
    const count = await prisma.purchaseReceipt.count();
    const receiptNumber = `REC-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    // Criar recebimento em transação
    const receipt = await prisma.$transaction(async (tx) => {
      // Criar recebimento
      const newReceipt = await tx.purchaseReceipt.create({
        data: {
          receiptNumber,
          purchaseOrderId: data.purchaseOrderId,
          receiptDate: new Date(data.receiptDate),
          invoiceNumber: data.invoiceNumber,
          notes: data.notes,
          items: {
            create: data.items.map(item => ({
              orderItemId: item.orderItemId,
              productId: item.productId,
              quantityReceived: item.quantityReceived,
              notes: item.notes,
            })),
          },
        },
        include: {
          items: {
            include: {
              product: true,
              orderItem: true,
            },
          },
          purchaseOrder: {
            include: {
              supplier: true,
            },
          },
        },
      });

      // Atualizar quantidade recebida nos itens do pedido
      for (const item of data.items) {
        const orderItem = order.items.find(oi => oi.id === item.orderItemId);
        
        await tx.purchaseOrderItem.update({
          where: { id: item.orderItemId },
          data: {
            receivedQty: orderItem!.receivedQty + item.quantityReceived,
          },
        });
      }

      return newReceipt;
    });

    // ✅ INTEGRAÇÃO: Registrar entrada de estoque para cada item
    for (const item of receipt.items) {
      try {
        await stockService.registerMovement({
          productId: item.productId,
          type: 'IN',
          quantity: item.quantityReceived,
          reason: `Recebimento de compra - Pedido ${order.orderNumber}`,
          reference: receipt.id,
          referenceType: 'PURCHASE',
          userId,
          notes: `Recebimento ${receipt.receiptNumber}, NF: ${receipt.invoiceNumber || 'N/A'}`,
        });

        console.log(
          `[PurchaseReceipt] Entrada de estoque registrada: ` +
          `${item.quantityReceived} un. de ${item.product.code}`
        );
      } catch (error: any) {
        console.error(`[PurchaseReceipt] Erro ao registrar entrada de estoque:`, error.message);
        
        await eventBus.emit(SystemEvents.SYSTEM_ERROR, {
          type: 'STOCK_ENTRY_FAILED',
          receiptId: receipt.id,
          productId: item.productId,
          error: error.message,
        });
      }
    }

    // ✅ INTEGRAÇÃO: Atualizar custos dos produtos
    await this.updateProductCosts(receipt.items);

    // ✅ INTEGRAÇÃO: Atualizar status do pedido
    await this.updateOrderStatus(data.purchaseOrderId);

    // ✅ EVENT: Emitir evento de recebimento
    await eventBus.emit(SystemEvents.PURCHASE_ORDER_RECEIVED, {
      receiptId: receipt.id,
      receiptNumber: receipt.receiptNumber,
      purchaseOrderId: order.id,
      orderNumber: order.orderNumber,
      supplierId: order.supplierId,
      itemsCount: receipt.items.length,
    });

    console.log(`[PurchaseReceipt] Recebimento ${receipt.receiptNumber} registrado com sucesso`);

    return receipt;
  }

  /**
   * Atualiza custos dos produtos baseado no recebimento
   * ✅ CORREÇÃO CRÍTICA: Calcula estoque real para custo médio correto
   */
  private async updateProductCosts(items: any[]) {
    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
      });

      if (!product) continue;

      // ✅ Buscar estoque real do produto
      const movements = await prisma.stockMovement.findMany({
        where: { productId: item.productId },
      });

      const currentStock = movements.reduce((sum, mov) => {
        return mov.type === 'IN' ? sum + mov.quantity : sum - mov.quantity;
      }, 0);

      // Calcular novo custo médio ponderado
      const currentValue = (product.averageCost || 0) * currentStock;
      const newStock = currentStock + item.quantityReceived;
      const newValue = currentValue + (item.orderItem.unitPrice * item.quantityReceived);
      
      const newAverageCost = newStock > 0 ? newValue / newStock : item.orderItem.unitPrice;

      // Atualizar produto
      await prisma.product.update({
        where: { id: item.productId },
        data: {
          lastCost: item.orderItem.unitPrice,
          averageCost: newAverageCost,
        },
      });

      console.log(
        `[PurchaseReceipt] Custo atualizado para ${item.product.code}: ` +
        `Estoque: ${currentStock} → ${newStock}, ` +
        `Último: R$ ${item.orderItem.unitPrice.toFixed(2)}, ` +
        `Médio: R$ ${newAverageCost.toFixed(2)}`
      );
    }
  }

  /**
   * Atualiza status do pedido baseado nos recebimentos
   */
  private async updateOrderStatus(orderId: string) {
    const order = await prisma.purchaseOrder.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) return;

    // Verificar se todos os itens foram recebidos
    const allReceived = order.items.every(item => item.receivedQty >= item.quantity);
    const someReceived = order.items.some(item => item.receivedQty > 0);

    let newStatus = order.status;

    if (allReceived) {
      newStatus = 'RECEIVED';
    } else if (someReceived) {
      newStatus = 'PARTIAL';
    }

    if (newStatus !== order.status) {
      await prisma.purchaseOrder.update({
        where: { id: orderId },
        data: { status: newStatus },
      });

      console.log(`[PurchaseReceipt] Status do pedido ${order.orderNumber} atualizado para ${newStatus}`);
    }
  }

  /**
   * Lista recebimentos
   */
  async getAll(filters?: {
    purchaseOrderId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const where: any = {};

    if (filters?.purchaseOrderId) {
      where.purchaseOrderId = filters.purchaseOrderId;
    }

    if (filters?.startDate || filters?.endDate) {
      where.receiptDate = {};
      if (filters.startDate) {
        where.receiptDate.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.receiptDate.lte = new Date(filters.endDate);
      }
    }

    return prisma.purchaseReceipt.findMany({
      where,
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
        purchaseOrder: {
          select: {
            id: true,
            orderNumber: true,
            supplier: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { receiptDate: 'desc' },
    });
  }

  /**
   * Busca recebimento por ID
   */
  async getById(id: string) {
    const receipt = await prisma.purchaseReceipt.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
            orderItem: true,
          },
        },
        purchaseOrder: {
          include: {
            supplier: true,
            items: true,
          },
        },
      },
    });

    if (!receipt) {
      throw new Error('Recebimento não encontrado');
    }

    return receipt;
  }

  /**
   * Cancela recebimento (estorna estoque)
   */
  async cancel(id: string, userId: string, reason: string) {
    const receipt = await this.getById(id);

    // Estornar estoque
    for (const item of receipt.items) {
      await stockService.registerMovement({
        productId: item.productId,
        type: 'OUT',
        quantity: item.quantityReceived,
        reason: `Estorno de recebimento - ${reason}`,
        reference: receipt.id,
        referenceType: 'PURCHASE',
        userId,
        notes: `Cancelamento do recebimento ${receipt.receiptNumber}`,
      });
    }

    // Atualizar quantidade recebida nos itens do pedido
    await prisma.$transaction(async (tx) => {
      for (const item of receipt.items) {
        const orderItem = await tx.purchaseOrderItem.findUnique({
          where: { id: item.orderItemId },
        });

        if (orderItem) {
          await tx.purchaseOrderItem.update({
            where: { id: item.orderItemId },
            data: {
              receivedQty: Math.max(0, orderItem.receivedQty - item.quantityReceived),
            },
          });
        }
      }

      // Deletar recebimento
      await tx.purchaseReceipt.delete({
        where: { id },
      });
    });

    // Atualizar status do pedido
    await this.updateOrderStatus(receipt.purchaseOrderId);

    console.log(`[PurchaseReceipt] Recebimento ${receipt.receiptNumber} cancelado`);
  }
}

export default new PurchaseReceiptService();
