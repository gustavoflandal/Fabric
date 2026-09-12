import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';

export interface UpsertYardWarehouseParamsDto {
  useYard: boolean;
  delayToleranceMinutes: number;
}

const DEFAULTS: UpsertYardWarehouseParamsDto = { useYard: true, delayToleranceMinutes: 15 };

const assertWarehouseExists = async (warehouseId: string) => {
  const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
  if (!warehouse) {
    throw new AppError(400, 'Armazém informado não existe');
  }
};

const assertToleranceInRange = (delayToleranceMinutes: number) => {
  if (delayToleranceMinutes < 0 || delayToleranceMinutes > 60) {
    throw new AppError(400, 'Tolerância de atraso deve estar entre 0 e 60 minutos');
  }
};

export class YardWarehouseParamsService {
  async getByWarehouseId(warehouseId: string) {
    const params = await prisma.yardWarehouseParams.findUnique({ where: { warehouseId } });
    if (params) return params;
    // Armazém ainda não tem linha própria: devolve os defaults sem persistir
    // nada — só grava no banco quando o usuário efetivamente salvar (Step de
    // upsert), consistente com o padrão do resto do projeto de não criar
    // registro até haver uma escrita real.
    return { id: null, warehouseId, ...DEFAULTS, createdAt: null, updatedAt: null };
  }

  async upsert(warehouseId: string, data: UpsertYardWarehouseParamsDto) {
    await assertWarehouseExists(warehouseId);
    assertToleranceInRange(data.delayToleranceMinutes);
    return prisma.yardWarehouseParams.upsert({
      where: { warehouseId },
      update: data,
      create: { warehouseId, ...data },
    });
  }
}

export default new YardWarehouseParamsService();
