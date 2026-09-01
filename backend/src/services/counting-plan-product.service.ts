import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface CreateCountingPlanProductDTO {
  planId: string;
  productId: string;
  priority?: number;
}

export interface UpdateCountingPlanProductDTO {
  priority?: number;
}

class CountingPlanProductService {
  /**
   * Adicionar produto ao plano
   */
  async addProduct(data: CreateCountingPlanProductDTO) {
    return await prisma.countingPlanProduct.create({
      data,
      include: {
        product: true
      }
    });
  }

  /**
   * Remover produto do plano
   */
  async removeProduct(planId: string, productId: string) {
    return await prisma.countingPlanProduct.delete({
      where: {
        planId_productId: {
          planId,
          productId
        }
      }
    });
  }

  /**
   * Listar produtos do plano
   */
  async listProducts(planId: string) {
    return await prisma.countingPlanProduct.findMany({
      where: { planId },
      include: {
        product: true
      },
      orderBy: {
        priority: 'desc'
      }
    });
  }

  /**
   * Atualizar prioridade do produto no plano
   */
  async updatePriority(planId: string, productId: string, data: UpdateCountingPlanProductDTO) {
    return await prisma.countingPlanProduct.update({
      where: {
        planId_productId: {
          planId,
          productId
        }
      },
      data
    });
  }
}

export default new CountingPlanProductService();
