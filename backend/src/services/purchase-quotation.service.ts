import { prisma } from '../config/database';

export interface CreatePurchaseQuotationDto {
  supplierId: string;
  dueDate: string;
  notes?: string;
  items: {
    productId: string;
    quantity: number;
    unitPrice: number;
    discount?: number;
    deliveryDays?: number;
    notes?: string;
  }[];
}

export interface UpdatePurchaseQuotationDto {
  supplierId?: string;
  dueDate?: string;
  status?: string;
  notes?: string;
  items?: {
    id?: string;
    productId: string;
    quantity: number;
    unitPrice: number;
    discount?: number;
    deliveryDays?: number;
    notes?: string;
  }[];
}

export class PurchaseQuotationService {
  async create(data: CreatePurchaseQuotationDto, createdBy: string) {
    // Gerar número do orçamento
    const count = await prisma.purchaseQuotation.count();
    const quotationNumber = `ORC-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    // Calcular total
    const totalValue = data.items.reduce((sum, item) => {
      const itemTotal = item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100);
      return sum + itemTotal;
    }, 0);

    // Criar orçamento com itens
    const quotation = await prisma.purchaseQuotation.create({
      data: {
        quotationNumber,
        supplierId: data.supplierId,
        dueDate: new Date(data.dueDate),
        notes: data.notes,
        totalValue,
        createdBy,
        items: {
          create: data.items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount || 0,
            totalPrice: item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100),
            deliveryDays: item.deliveryDays,
            notes: item.notes,
          })),
        },
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

    return quotation;
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
      where.requestDate = {
        gte: new Date(filters.startDate),
      };
    }

    if (filters?.endDate) {
      where.requestDate = {
        ...where.requestDate,
        lte: new Date(filters.endDate),
      };
    }

    const [quotations, total] = await Promise.all([
      prisma.purchaseQuotation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { requestDate: 'desc' },
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
      }),
      prisma.purchaseQuotation.count({ where }),
    ]);

    return {
      data: quotations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string) {
    const quotation = await prisma.purchaseQuotation.findUnique({
      where: { id },
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
        purchaseOrders: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            totalValue: true,
          },
        },
      },
    });

    if (!quotation) {
      throw new Error('Orçamento não encontrado');
    }

    return quotation;
  }

  async update(id: string, data: UpdatePurchaseQuotationDto) {
    const quotation = await this.getById(id);

    // Recalcular total se houver itens
    let totalValue = quotation.totalValue;
    if (data.items) {
      totalValue = data.items.reduce((sum, item) => {
        const itemTotal = item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100);
        return sum + itemTotal;
      }, 0);

      // Deletar itens antigos
      await prisma.purchaseQuotationItem.deleteMany({
        where: { quotationId: id },
      });
    }

    // Atualizar orçamento
    const updated = await prisma.purchaseQuotation.update({
      where: { id },
      data: {
        supplierId: data.supplierId,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        status: data.status,
        notes: data.notes,
        totalValue,
        items: data.items
          ? {
              create: data.items.map(item => ({
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                discount: item.discount || 0,
                totalPrice: item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100),
                deliveryDays: item.deliveryDays,
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
    const quotation = await prisma.purchaseQuotation.update({
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

    return quotation;
  }

  async approve(id: string, approvedBy: string) {
    const quotation = await prisma.purchaseQuotation.update({
      where: { id },
      data: { 
        status: 'APPROVED',
        approvedBy,
        approvedAt: new Date(),
      },
      include: {
        supplier: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    return quotation;
  }

  async delete(id: string) {
    // Verificar se há pedidos vinculados
    const quotation = await this.getById(id);
    if (quotation.purchaseOrders && quotation.purchaseOrders.length > 0) {
      throw new Error('Não é possível excluir orçamento com pedidos vinculados');
    }

    await prisma.purchaseQuotation.delete({
      where: { id },
    });
  }

  async getBySupplier(supplierId: string) {
    const quotations = await prisma.purchaseQuotation.findMany({
      where: { supplierId },
      orderBy: { requestDate: 'desc' },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    return quotations;
  }
}

export default new PurchaseQuotationService();
