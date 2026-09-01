import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';

export interface BomItemInput {
  componentId: string;
  quantity: number;
  unitId: string;
  scrapFactor?: number;
  sequence?: number;
  notes?: string | null;
}

export interface CreateBomDto {
  productId: string;
  description?: string | null;
  validFrom?: Date | string;
  validTo?: Date | string | null;
  active?: boolean;
  version?: number;
  items: BomItemInput[];
}

export interface UpdateBomDto {
  description?: string | null;
  validFrom?: Date | string;
  validTo?: Date | string | null;
  active?: boolean;
  version?: number;
  items?: BomItemInput[];
}

export interface BomFilters {
  productId?: string;
  active?: boolean;
}

export class BomService {
  async list(filters: BomFilters = {}) {
    const where: any = {};

    if (filters.productId) {
      where.productId = filters.productId;
    }

    if (filters.active !== undefined) {
      where.active = filters.active;
    }

    const boms = await prisma.bOM.findMany({
      where,
      orderBy: [{ productId: 'asc' }, { version: 'desc' }],
      include: {
        product: {
          select: { id: true, code: true, name: true, type: true },
        },
        items: {
          orderBy: { sequence: 'asc' },
          include: {
            component: { select: { id: true, code: true, name: true, type: true } },
            unit: { select: { id: true, code: true, name: true, symbol: true } },
          },
        },
      },
    });

    return boms;
  }

  async getById(id: string) {
    const bom = await prisma.bOM.findUnique({
      where: { id },
      include: {
        product: {
          select: { id: true, code: true, name: true, type: true },
        },
        items: {
          orderBy: { sequence: 'asc' },
          include: {
            component: { select: { id: true, code: true, name: true, type: true } },
            unit: { select: { id: true, code: true, name: true, symbol: true } },
          },
        },
      },
    });

    if (!bom) {
      throw new AppError(404, 'BOM não encontrada');
    }

    return bom;
  }

  async getActiveByProduct(productId: string) {
    const bom = await prisma.bOM.findFirst({
      where: { productId, active: true },
      orderBy: { version: 'desc' },
      include: {
        items: {
          orderBy: { sequence: 'asc' },
          include: {
            component: { select: { id: true, code: true, name: true, type: true } },
            unit: { select: { id: true, code: true, name: true, symbol: true } },
          },
        },
      },
    });

    if (!bom) {
      throw new AppError(404, 'Nenhuma BOM ativa encontrada para o produto');
    }

    return bom;
  }

  async create(data: CreateBomDto) {
    return prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: data.productId } });
      if (!product) {
        throw new AppError(404, 'Produto não encontrado');
      }

      let version = data.version;
      if (!version) {
        const latest = await tx.bOM.findFirst({
          where: { productId: data.productId },
          orderBy: { version: 'desc' },
        });
        version = (latest?.version ?? 0) + 1;
      } else {
        const existingVersion = await tx.bOM.findFirst({
          where: { productId: data.productId, version },
        });
        if (existingVersion) {
          throw new AppError(409, `Já existe uma versão ${version} para este produto`);
        }
      }

      const bom = await tx.bOM.create({
        data: {
          productId: data.productId,
          description: data.description,
          validFrom: data.validFrom as Date | undefined,
          validTo: data.validTo as Date | undefined,
          active: data.active ?? true,
          version,
          items: {
            create: data.items.map((item, index) => ({
              componentId: item.componentId,
              quantity: item.quantity,
              unitId: item.unitId,
              scrapFactor: item.scrapFactor ?? 0,
              sequence: item.sequence ?? index + 1,
              notes: item.notes,
            })),
          },
        },
        include: {
          product: { select: { id: true, code: true, name: true, type: true } },
          items: {
            orderBy: { sequence: 'asc' },
            include: {
              component: { select: { id: true, code: true, name: true, type: true } },
              unit: { select: { id: true, code: true, name: true, symbol: true } },
            },
          },
        },
      });

      if (bom.active) {
        await tx.bOM.updateMany({
          where: {
            productId: data.productId,
            id: { not: bom.id },
          },
          data: { active: false },
        });
      }

      return bom;
    });
  }

  async update(id: string, data: UpdateBomDto) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.bOM.findUnique({ where: { id } });
      if (!existing) {
        throw new AppError(404, 'BOM não encontrada');
      }

      if (data.version && data.version !== existing.version) {
        const versionExists = await tx.bOM.findFirst({
          where: {
            productId: existing.productId,
            version: data.version,
            id: { not: id },
          },
        });
        if (versionExists) {
          throw new AppError(409, `Já existe uma versão ${data.version} para este produto`);
        }
      }

      const updated = await tx.bOM.update({
        where: { id },
        data: {
          description: data.description,
          validFrom: data.validFrom as Date | undefined,
          validTo: data.validTo as Date | undefined,
          active: data.active,
          version: data.version,
        },
      });

      if (data.items) {
        await tx.bOMItem.deleteMany({ where: { bomId: id } });
        await tx.bOMItem.createMany({
          data: data.items.map((item, index) => ({
            bomId: id,
            componentId: item.componentId,
            quantity: item.quantity,
            unitId: item.unitId,
            scrapFactor: item.scrapFactor ?? 0,
            sequence: item.sequence ?? index + 1,
            notes: item.notes ?? null,
          })),
        });
      }

      if (data.active === true) {
        await tx.bOM.updateMany({
          where: {
            productId: updated.productId,
            id: { not: updated.id },
          },
          data: { active: false },
        });
      }

      return this.getById(id);
    });
  }

  async delete(id: string) {
    await this.getById(id);
    await prisma.bOM.delete({ where: { id } });
    return { message: 'BOM excluída com sucesso' };
  }

  async setActive(id: string, active: boolean) {
    return prisma.$transaction(async (tx) => {
      const bom = await tx.bOM.findUnique({ where: { id } });
      if (!bom) {
        throw new AppError(404, 'BOM não encontrada');
      }

      await tx.bOM.update({ where: { id }, data: { active } });

      if (active) {
        await tx.bOM.updateMany({
          where: { productId: bom.productId, id: { not: id } },
          data: { active: false },
        });
      }

      return this.getById(id);
    });
  }

  async explode(id: string, quantity = 1) {
    const bom = await this.getById(id);

    const explosion = bom.items.map((item) => {
      const requiredQuantity = quantity * item.quantity * (1 + (item.scrapFactor ?? 0));
      return {
        componentId: item.componentId,
        componentCode: item.component.code,
        componentName: item.component.name,
        unit: item.unit,
        sequence: item.sequence,
        quantity: Number(requiredQuantity.toFixed(6)),
        scrapFactor: item.scrapFactor,
        notes: item.notes,
      };
    });

    return {
      bom: {
        id: bom.id,
        productId: bom.productId,
        version: bom.version,
        description: bom.description,
      },
      quantity,
      items: explosion,
    };
  }
}

export default new BomService();
