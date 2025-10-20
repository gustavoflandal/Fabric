import { prisma } from '../config/database';

export interface CreatePurchaseOrderDto {
  supplierId: string;
  quotationId?: string;
  expectedDate: string;
  paymentTerms?: string;
  paymentMethod?: string;
  shippingCost?: number;
  discount?: number;
  notes?: string;
  items: {
    productId: string;
    quantity: number;
    unitPrice: number;
    discount?: number;
    notes?: string;
  }[];
}

export interface UpdatePurchaseOrderDto {
  supplierId?: string;
  expectedDate?: string;
  status?: string;
  paymentTerms?: string;
  paymentMethod?: string;
  shippingCost?: number;
  discount?: number;
  notes?: string;
  items?: {
    id?: string;
    productId: string;
    quantity: number;
    unitPrice: number;
    discount?: number;
    notes?: string;
  }[];
}

export class PurchaseOrderService {
  async create(data: CreatePurchaseOrderDto, createdBy: string) {
    // Gerar número do pedido
    const count = await prisma.purchaseOrder.count();
    const orderNumber = `PC-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    // Calcular total dos itens
    const itemsTotal = data.items.reduce((sum, item) => {
      const itemTotal = item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100);
      return sum + itemTotal;
    }, 0);

    // Calcular total final
    const totalValue = itemsTotal + (data.shippingCost || 0) - (data.discount || 0);

    // Criar pedido com itens
    const order = await prisma.purchaseOrder.create({
      data: {
        orderNumber,
        supplierId: data.supplierId,
        quotationId: data.quotationId,
        expectedDate: new Date(data.expectedDate),
        paymentTerms: data.paymentTerms,
        paymentMethod: data.paymentMethod,
        shippingCost: data.shippingCost || 0,
        discount: data.discount || 0,
        totalValue,
        notes: data.notes,
        createdBy,
        items: {
          create: data.items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount || 0,
            totalPrice: item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100),
            notes: item.notes,
          })),
        },
      },
      include: {
        supplier: true,
        quotation: true,
        items: {
          include: {
            product: {
              include: {
                unit: true,
              },
            },
          },
        },
      },
    });

    return order;
  }

  async createFromQuotation(quotationId: string, createdBy: string) {
    // Buscar orçamento
    const quotation = await prisma.purchaseQuotation.findUnique({
      where: { id: quotationId },
      include: {
        items: true,
      },
    });

    if (!quotation) {
      throw new Error('Orçamento não encontrado');
    }

    if (quotation.status !== 'APPROVED') {
      throw new Error('Apenas orçamentos APROVADOS podem gerar pedidos. Status atual: ' + quotation.status);
    }

    // Criar pedido a partir do orçamento
    const orderData: CreatePurchaseOrderDto = {
      supplierId: quotation.supplierId,
      quotationId: quotation.id,
      expectedDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 dias
      notes: `Pedido gerado a partir do orçamento ${quotation.quotationNumber}`,
      items: quotation.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
        notes: item.notes || undefined,
      })),
    };

    return this.create(orderData, createdBy);
  }

  async getAll(
    page = 1,
    limit = 20,
    filters?: {
      supplierId?: string;
      status?: string;
      startDate?: string;
      endDate?: string;
    }
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filters?.supplierId) {
      where.supplierId = filters.supplierId;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.startDate) {
      where.orderDate = {
        gte: new Date(filters.startDate),
      };
    }

    if (filters?.endDate) {
      where.orderDate = {
        ...where.orderDate,
        lte: new Date(filters.endDate),
      };
    }

    const [orders, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { orderDate: 'desc' },
        include: {
          supplier: true,
          quotation: {
            select: {
              quotationNumber: true,
            },
          },
          items: {
            include: {
              product: {
                include: {
                  unit: true,
                },
              },
            },
          },
        },
      }),
      prisma.purchaseOrder.count({ where }),
    ]);

    return {
      data: orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string) {
    const order = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        quotation: {
          select: {
            quotationNumber: true,
            requestDate: true,
          },
        },
        items: {
          include: {
            product: {
              include: {
                unit: true,
              },
            },
          },
        },
        receipts: {
          include: {
            items: true,
          },
        },
      },
    });

    if (!order) {
      throw new Error('Pedido de compra não encontrado');
    }

    return order;
  }

  async update(id: string, data: UpdatePurchaseOrderDto) {
    const order = await this.getById(id);

    // Verificar se pode editar
    if (order.status === 'RECEIVED' || order.status === 'CANCELLED') {
      throw new Error('Não é possível editar pedido recebido ou cancelado');
    }

    // Recalcular total se houver itens
    let totalValue = order.totalValue;
    if (data.items) {
      const itemsTotal = data.items.reduce((sum, item) => {
        const itemTotal = item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100);
        return sum + itemTotal;
      }, 0);

      totalValue = itemsTotal + (data.shippingCost || order.shippingCost) - (data.discount || order.discount);

      // Deletar itens antigos
      await prisma.purchaseOrderItem.deleteMany({
        where: { orderId: id },
      });
    }

    // Atualizar pedido
    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        supplierId: data.supplierId,
        expectedDate: data.expectedDate ? new Date(data.expectedDate) : undefined,
        status: data.status,
        paymentTerms: data.paymentTerms,
        paymentMethod: data.paymentMethod,
        shippingCost: data.shippingCost,
        discount: data.discount,
        totalValue,
        notes: data.notes,
        items: data.items
          ? {
              create: data.items.map(item => ({
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                discount: item.discount || 0,
                totalPrice: item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100),
                notes: item.notes,
              })),
            }
          : undefined,
      },
      include: {
        supplier: true,
        items: {
          include: {
            product: {
              include: {
                unit: true,
              },
            },
          },
        },
      },
    });

    return updated;
  }

  async updateStatus(id: string, status: string) {
    const order = await prisma.purchaseOrder.update({
      where: { id },
      data: { status },
      include: {
        supplier: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    return order;
  }

  async confirm(id: string) {
    const order = await this.getById(id);
    
    if (order.status !== 'APPROVED') {
      throw new Error('Apenas pedidos APROVADOS podem ser confirmados. Status atual: ' + order.status);
    }
    
    return this.updateStatus(id, 'CONFIRMED');
  }

  async cancel(id: string) {
    const order = await this.getById(id);

    if (order.status === 'RECEIVED') {
      throw new Error('Não é possível cancelar pedido já recebido');
    }

    return this.updateStatus(id, 'CANCELLED');
  }

  async delete(id: string) {
    const order = await this.getById(id);

    if (order.receipts && order.receipts.length > 0) {
      throw new Error('Não é possível excluir pedido com recebimentos');
    }

    await prisma.purchaseOrder.delete({
      where: { id },
    });
  }

  async getBySupplier(supplierId: string) {
    const orders = await prisma.purchaseOrder.findMany({
      where: { supplierId },
      orderBy: { orderDate: 'desc' },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    return orders;
  }

  async getPendingOrders() {
    const orders = await prisma.purchaseOrder.findMany({
      where: {
        status: {
          in: ['PENDING', 'CONFIRMED'],
        },
      },
      orderBy: { expectedDate: 'asc' },
      include: {
        supplier: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    return orders;
  }
}

export default new PurchaseOrderService();
