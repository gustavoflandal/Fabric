import { prisma } from '../config/database';
import stockService from './stock.service';
import { eventBus, SystemEvents } from '../events/event-bus';
import { AppError } from '../middleware/error.middleware';

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
      throw new AppError(404, 'Pedido de compra não encontrado');
    }

    if (order.status === 'CANCELLED') {
      throw new AppError(400, 'Não é possível receber pedido cancelado');
    }

    // Validar itens
    for (const item of data.items) {
      const orderItem = order.items.find(oi => oi.id === item.orderItemId);

      if (!orderItem) {
        throw new AppError(404, `Item ${item.orderItemId} não encontrado no pedido`);
      }

      const totalReceived = orderItem.receivedQty + item.quantityReceived;

      if (totalReceived > orderItem.quantity) {
        throw new AppError(
          400,
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
          orderId: data.purchaseOrderId,
          receiptDate: new Date(data.receiptDate),
          receivedBy: userId,
          // PurchaseReceipt não tem coluna própria para nota fiscal - guardamos
          // junto das observações em vez de adicionar uma migration só pra isso.
          notes: data.invoiceNumber
            ? `NF: ${data.invoiceNumber}${data.notes ? ` - ${data.notes}` : ''}`
            : data.notes,
          items: {
            // O DTO só recebe uma quantidade recebida por item (sem fluxo de
            // aceite/rejeição do lado do cliente ainda); todo o recebido entra
            // como aceito. acceptedQty é o que de fato entra em estoque/custo.
            create: data.items.map(item => ({
              orderItemId: item.orderItemId,
              productId: item.productId,
              quantity: item.quantityReceived,
              acceptedQty: item.quantityReceived,
              rejectedQty: 0,
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
          order: {
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
          quantity: item.acceptedQty,
          reason: `Recebimento de compra - Pedido ${order.orderNumber}`,
          reference: receipt.id,
          referenceType: 'PURCHASE',
          userId,
          notes: `Recebimento ${receipt.receiptNumber}${data.invoiceNumber ? `, NF: ${data.invoiceNumber}` : ''}`,
        });

        console.log(
          `[PurchaseReceipt] Entrada de estoque registrada: ` +
          `${item.acceptedQty} un. de ${item.product.code}`
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
   *
   * ✅ CORREÇÃO (Fase 1, item 1.6 do cronograma):
   * 1) Atomicidade: lia `product.averageCost` e escrevia de volta fora de
   *    qualquer transação/lock - dois recebimentos concorrentes do mesmo
   *    produto podiam calcular o custo médio a partir do mesmo valor
   *    desatualizado (lost update). Agora cada produto é travado
   *    (`SELECT ... FOR UPDATE`) dentro de uma transação por item.
   * 2) Cálculo: usava `prisma.stockMovement.findMany` somando TODO o
   *    histórico (o padrão O(n) que stock.service.ts já não usa mais desde
   *    a Fase 1.1/1.2) e, pior, isso já incluía a própria entrada de
   *    estoque deste recebimento (registrada no loop logo antes, em
   *    `create()`) - somava `item.quantityReceived` DUAS vezes no estoque
   *    usado para ponderar o custo médio. Agora lê o saldo persistido
   *    (`stock_balances`, já atualizado por essa entrada) e subtrai a
   *    quantidade deste item para achar o saldo anterior ao recebimento.
   */
  private async updateProductCosts(items: any[]) {
    for (const item of items) {
      await prisma.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<{ averageCost: number | null }[]>`
          SELECT averageCost FROM products WHERE id = ${item.productId} FOR UPDATE
        `;
        if (locked.length === 0) return;

        const balance = await tx.stockBalance.findUnique({ where: { productId: item.productId } });
        // stock_balances já reflete a entrada deste recebimento (registrada antes, em create())
        const postReceiptStock = balance?.quantity ?? item.acceptedQty;
        const preReceiptStock = postReceiptStock - item.acceptedQty;

        // Calcular novo custo médio ponderado
        const currentValue = (locked[0].averageCost || 0) * preReceiptStock;
        const newValue = currentValue + (item.orderItem.unitPrice * item.acceptedQty);
        const newAverageCost = postReceiptStock > 0 ? newValue / postReceiptStock : item.orderItem.unitPrice;

        await tx.product.update({
          where: { id: item.productId },
          data: {
            lastCost: item.orderItem.unitPrice,
            averageCost: newAverageCost,
          },
        });

        console.log(
          `[PurchaseReceipt] Custo atualizado para ${item.product.code}: ` +
          `Estoque: ${preReceiptStock} → ${postReceiptStock}, ` +
          `Último: R$ ${item.orderItem.unitPrice.toFixed(2)}, ` +
          `Médio: R$ ${newAverageCost.toFixed(2)}`
        );
      });
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
    } else if (order.status === 'PARTIAL' || order.status === 'RECEIVED') {
      // ✅ Achado ao testar o cancel() corrigido (Fase 1, item 1.6): esta
      // função só avançava o status (PARTIAL/RECEIVED), nunca revertia -
      // cancelar todos os recebimentos de um pedido deixava o status
      // "RECEIVED" para sempre, mesmo com receivedQty voltando a 0.
      newStatus = 'CONFIRMED';
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
      where.orderId = filters.purchaseOrderId;
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
        order: {
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
        order: {
          include: {
            supplier: true,
            items: true,
          },
        },
      },
    });

    if (!receipt) {
      throw new AppError(404, 'Recebimento não encontrado');
    }

    return receipt;
  }

  /**
   * Cancela recebimento (estorna estoque)
   *
   * ✅ CORREÇÃO ATOMICIDADE (Fase 1, item 1.6 do cronograma): antes, o
   * estorno de estoque (um `registerMovement` por item, cada um em sua
   * própria transação) rodava inteiramente FORA da transação que atualiza
   * `purchaseOrderItem.receivedQty` e apaga o recebimento. Se a segunda
   * parte falhasse (ou o processo caísse no meio), o estoque já tinha sido
   * estornado sem o recebimento ser removido - estado inconsistente.
   * Agora tudo roda em uma única transação, usando
   * `stockService.registerMovementInTransaction` para reaproveitar o `tx`.
   */
  async cancel(id: string, userId: string, reason: string) {
    const receipt = await this.getById(id);

    await prisma.$transaction(async (tx) => {
      for (const item of receipt.items) {
        await stockService.registerMovementInTransaction(tx, {
          productId: item.productId,
          type: 'OUT',
          quantity: item.acceptedQty,
          reason: `Estorno de recebimento - ${reason}`,
          reference: receipt.id,
          referenceType: 'PURCHASE',
          userId,
          notes: `Cancelamento do recebimento ${receipt.receiptNumber}`,
        });

        const orderItem = await tx.purchaseOrderItem.findUnique({
          where: { id: item.orderItemId },
        });

        if (orderItem) {
          await tx.purchaseOrderItem.update({
            where: { id: item.orderItemId },
            data: {
              receivedQty: Math.max(0, orderItem.receivedQty - item.acceptedQty),
            },
          });
        }
      }

      // Deletar recebimento
      await tx.purchaseReceipt.delete({
        where: { id },
      });
    });

    // Atualizar status do pedido (fora da transação - leitura derivada, não crítica)
    await this.updateOrderStatus(receipt.orderId);

    console.log(`[PurchaseReceipt] Recebimento ${receipt.receiptNumber} cancelado`);
  }
}

export default new PurchaseReceiptService();
