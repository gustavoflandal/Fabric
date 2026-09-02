import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';

export interface CreateProductDto {
  code: string;
  name: string;
  description?: string;
  type: string;
  unitId: string;
  categoryId?: string;
  leadTime?: number;
  lotSize?: number;
  minStock?: number;
  maxStock?: number;
  safetyStock?: number;
  reorderPoint?: number;
  standardCost?: number;
  lastCost?: number;
  averageCost?: number;
  // Dados para Armazenagem (WMS) - F0.9. Opcionais: instalação só-PCP nunca
  // preenche. weight em kg; width/height/depth em m; volume em m³.
  weight?: number | null;
  width?: number | null;
  height?: number | null;
  depth?: number | null;
  volume?: number | null;
  packagingType?: string | null;
  maxStackQty?: number | null;
  segregationGroup?: string | null;
  /**
   * Fase 5 do plano do WMS — controle de lote OPT-IN por produto. `false` na
   * coluna, então todo produto existente segue exatamente como antes.
   *
   * LIGAR a flag não retroage: o saldo que já estava endereçado continua sem
   * lote (não há como inventar o número de um lote que ninguém leu), e o
   * planejamento de picking consome esse estoque legado por último. DESLIGAR
   * também não apaga nada — os `Lot` e o `lotId` das linhas de saldo continuam
   * lá, e o produto simplesmente para de exigir lote em novos recebimentos.
   */
  lotTracked?: boolean;
  active?: boolean;
}

export interface UpdateProductDto extends Partial<CreateProductDto> {}

/**
 * F0.9: o volume unitário pode ser informado explicitamente (embalagem
 * irregular, em que largura × altura × profundidade superestima muito) ou
 * derivado das três dimensões. Só deriva quando o cliente NÃO informou volume e
 * as três dimensões estão presentes no mesmo payload — nunca sobrescreve um
 * volume informado, e num update parcial que mande só uma dimensão não há como
 * recalcular sem reler o produto, então o volume fica como está.
 */
const withDerivedVolume = <T extends UpdateProductDto>(data: T): T => {
  const { volume, width, height, depth } = data;

  if (
    (volume === undefined || volume === null) &&
    typeof width === 'number' &&
    typeof height === 'number' &&
    typeof depth === 'number'
  ) {
    return { ...data, volume: width * height * depth };
  }

  return data;
};

export class ProductService {
  async create(data: CreateProductDto) {
    return await prisma.product.create({
      data: withDerivedVolume(data),
      include: { unit: true, category: true },
    });
  }

  async getAll(page = 1, limit = 100, filters?: {
    type?: string;
    categoryId?: string;
    active?: boolean;
    search?: string;
  }) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filters?.type) where.type = filters.type;
    if (filters?.categoryId) where.categoryId = filters.categoryId;
    if (filters?.active !== undefined) where.active = filters.active;
    if (filters?.search) {
      where.OR = [
        { code: { contains: filters.search } },
        { name: { contains: filters.search } },
        { description: { contains: filters.search } },
      ];
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: { unit: true, category: true },
      }),
      prisma.product.count({ where }),
    ]);

    return {
      data: products,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async getById(id: string) {
    return await prisma.product.findUnique({
      where: { id },
      include: { unit: true, category: true },
    });
  }

  async update(id: string, data: UpdateProductDto) {
    return await prisma.product.update({
      where: { id },
      data: withDerivedVolume(data),
      include: { unit: true, category: true },
    });
  }

  async delete(id: string) {
    return await prisma.product.delete({ where: { id } });
  }

  async toggleActive(id: string) {
    const product = await this.getById(id);
    if (!product) throw new AppError(404, 'Produto não encontrado');
    return await this.update(id, { active: !product.active });
  }
}

export default new ProductService();
