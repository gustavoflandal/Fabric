import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';

export interface UpdateYardSpotDto {
  code?: string;
}

export interface YardSpotFilters {
  areaId?: string;
  blocked?: boolean;
}

const assertAreaExists = async (areaId: string) => {
  const area = await prisma.yardArea.findUnique({ where: { id: areaId } });
  if (!area) throw new AppError(400, 'Área informada não existe');
  return area;
};

export class YardSpotService {
  async generateBatch(areaId: string, count: number) {
    if (count < 1 || count > 500) {
      throw new AppError(400, 'Quantidade deve ser entre 1 e 500');
    }
    const area = await assertAreaExists(areaId);
    const existing = await prisma.yardSpot.count({ where: { areaId } });

    const data = Array.from({ length: count }, (_, i) => {
      const sequence = existing + i + 1;
      return { areaId, code: `${area.code}-${String(sequence).padStart(2, '0')}` };
    });

    await prisma.yardSpot.createMany({ data });

    return prisma.yardSpot.findMany({
      where: { areaId, code: { in: data.map((d) => d.code) } },
      orderBy: { code: 'asc' },
    });
  }

  async getAll(page = 1, limit = 100, filters?: YardSpotFilters) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (filters?.areaId) where.areaId = filters.areaId;
    if (filters?.blocked !== undefined) where.blocked = filters.blocked;

    const [spots, total] = await Promise.all([
      prisma.yardSpot.findMany({
        where,
        skip,
        take: limit,
        orderBy: { code: 'asc' },
        include: {
          area: { select: { id: true, code: true, name: true } },
          visits: { where: { status: 'IN_YARD' }, select: { id: true, vehicle: { select: { plate: true } } }, take: 1 },
        },
      }),
      prisma.yardSpot.count({ where }),
    ]);

    return { data: spots, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async getById(id: string) {
    return prisma.yardSpot.findUnique({
      where: { id },
      include: { area: { select: { id: true, code: true, name: true } } },
    });
  }

  async update(id: string, data: UpdateYardSpotDto) {
    return prisma.yardSpot.update({ where: { id }, data });
  }

  async delete(id: string) {
    const activeVisit = await prisma.yardVisit.findFirst({ where: { yardSpotId: id, status: 'IN_YARD' } });
    if (activeVisit) {
      throw new AppError(400, 'Não é possível excluir uma vaga com um veículo alocado nela');
    }
    return prisma.yardSpot.delete({ where: { id } });
  }

  async setBlocked(id: string, blocked: boolean, blockedReason: string | null) {
    return prisma.yardSpot.update({ where: { id }, data: { blocked, blockedReason: blocked ? blockedReason : null } });
  }
}

export default new YardSpotService();
