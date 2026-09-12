import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import yardWarehouseParamsService from './yard-warehouse-params.service';

export interface CreateYardVisitDto {
  warehouseId: string;
  serviceType: 'RECEBIMENTO' | 'EXPEDICAO' | 'MULTIUSO';
  supplierId?: string | null;
  purchaseOrderId?: string | null;
  scheduledAt: Date;
  notes?: string | null;
  driverId?: string | null;
  vehicleId?: string | null;
}

export interface UpdateYardVisitDto {
  serviceType?: 'RECEBIMENTO' | 'EXPEDICAO' | 'MULTIUSO';
  supplierId?: string | null;
  purchaseOrderId?: string | null;
  scheduledAt?: Date;
  notes?: string | null;
}

export interface CheckInYardVisitDto {
  driverId: string;
  vehicleId: string;
}

export interface YardVisitFilters {
  warehouseId?: string;
  status?: 'SCHEDULED' | 'CHECKED_IN' | 'CANCELLED';
  serviceType?: 'RECEBIMENTO' | 'EXPEDICAO' | 'MULTIUSO';
  vehicleId?: string;
}

export type PunctualityStatus = 'NO_HORARIO' | 'ANTECIPADO' | 'ATRASADO';

function computePunctuality(scheduledAt: Date, referenceTime: Date, toleranceMinutes: number): PunctualityStatus {
  const diffMinutes = (referenceTime.getTime() - scheduledAt.getTime()) / 60_000;
  if (Math.abs(diffMinutes) <= toleranceMinutes) return 'NO_HORARIO';
  return diffMinutes < 0 ? 'ANTECIPADO' : 'ATRASADO';
}

const assertWarehouseExists = async (warehouseId: string) => {
  const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
  if (!warehouse) throw new AppError(400, 'Armazém informado não existe');
};

const assertPurchaseOrderExists = async (purchaseOrderId: string) => {
  const po = await prisma.purchaseOrder.findUnique({ where: { id: purchaseOrderId } });
  if (!po) throw new AppError(400, 'Pedido de compra informado não existe');
  return po;
};

const runCheckInValidations = async (visit: { supplierId: string | null }, driverId: string, vehicleId: string) => {
  const [driver, vehicle] = await Promise.all([
    prisma.driver.findUnique({ where: { id: driverId } }),
    prisma.vehicle.findUnique({ where: { id: vehicleId } }),
  ]);
  if (!driver) throw new AppError(400, 'Motorista informado não existe');
  if (!vehicle) throw new AppError(400, 'Veículo informado não existe');
  if (driver.blocked) throw new AppError(400, 'Motorista está bloqueado');
  if (vehicle.blocked) throw new AppError(400, 'Veículo está bloqueado');

  const activeVisit = await prisma.yardVisit.findFirst({ where: { vehicleId, status: 'CHECKED_IN' } });
  if (activeVisit) throw new AppError(400, 'Este veículo já possui uma visita ativa no pátio');

  if (visit.supplierId && (driver.supplierId !== visit.supplierId || vehicle.supplierId !== visit.supplierId)) {
    throw new AppError(400, 'Motorista ou veículo pertencem a um fornecedor diferente do agendamento');
  }
};

export class YardVisitService {
  // Para o caminho walk-in (driverId+vehicleId já no create), as validações de
  // check-in rodam ANTES do prisma.yardVisit.create — nunca depois. Validar
  // depois deixaria, no caminho de erro, um registro CHECKED_IN órfão já
  // persistido antes da validação reprovar (ex.: motorista bloqueado):
  // o INSERT teria que ser desfeito, e nada neste método faz isso. Correndo
  // a validação primeiro, um walk-in reprovado nunca chega a existir no banco.
  async create(data: CreateYardVisitDto) {
    await assertWarehouseExists(data.warehouseId);

    let supplierId = data.supplierId ?? null;
    if (data.purchaseOrderId) {
      const po = await assertPurchaseOrderExists(data.purchaseOrderId);
      supplierId = po.supplierId;
    }

    const isWalkIn = !!data.driverId && !!data.vehicleId;

    if (isWalkIn) {
      await runCheckInValidations({ supplierId }, data.driverId!, data.vehicleId!);
    }

    return prisma.yardVisit.create({
      data: {
        warehouseId: data.warehouseId,
        serviceType: data.serviceType,
        supplierId,
        purchaseOrderId: data.purchaseOrderId ?? null,
        scheduledAt: data.scheduledAt,
        notes: data.notes ?? null,
        status: isWalkIn ? 'CHECKED_IN' : 'SCHEDULED',
        driverId: isWalkIn ? data.driverId : null,
        vehicleId: isWalkIn ? data.vehicleId : null,
        checkedInAt: isWalkIn ? new Date() : null,
      },
    });
  }

  async getAll(page = 1, limit = 100, filters?: YardVisitFilters) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filters?.warehouseId) where.warehouseId = filters.warehouseId;
    if (filters?.status) where.status = filters.status;
    if (filters?.serviceType) where.serviceType = filters.serviceType;
    if (filters?.vehicleId) where.vehicleId = filters.vehicleId;

    const [visits, total] = await Promise.all([
      prisma.yardVisit.findMany({
        where,
        skip,
        take: limit,
        orderBy: { scheduledAt: 'desc' },
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
          supplier: { select: { id: true, code: true, name: true } },
          driver: { select: { id: true, name: true } },
          vehicle: { select: { id: true, plate: true } },
        },
      }),
      prisma.yardVisit.count({ where }),
    ]);

    const withPunctuality = await Promise.all(visits.map((v) => this.attachPunctuality(v)));

    return { data: withPunctuality, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async getById(id: string) {
    const visit = await prisma.yardVisit.findUnique({
      where: { id },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        supplier: { select: { id: true, code: true, name: true } },
        driver: { select: { id: true, name: true } },
        vehicle: { select: { id: true, plate: true } },
      },
    });
    if (!visit) return null;
    return this.attachPunctuality(visit);
  }

  private async attachPunctuality(visit: any) {
    if (visit.status === 'CANCELLED') return { ...visit, punctuality: null };
    const params = await yardWarehouseParamsService.getByWarehouseId(visit.warehouseId);
    const referenceTime = visit.checkedInAt ?? new Date();
    const punctuality = computePunctuality(visit.scheduledAt, referenceTime, params.delayToleranceMinutes);
    return { ...visit, punctuality };
  }

  async update(id: string, data: UpdateYardVisitDto) {
    const current = await prisma.yardVisit.findUnique({ where: { id } });
    if (!current) throw new AppError(404, 'Visita não encontrada');

    const updateData: UpdateYardVisitDto = { ...data };

    if (data.purchaseOrderId) {
      const po = await assertPurchaseOrderExists(data.purchaseOrderId);
      updateData.supplierId = po.supplierId;
    }

    return prisma.yardVisit.update({ where: { id }, data: updateData });
  }

  async delete(id: string) {
    const visit = await prisma.yardVisit.findUnique({ where: { id } });
    if (!visit) throw new AppError(404, 'Visita não encontrada');
    if (visit.status !== 'SCHEDULED') {
      throw new AppError(400, 'Só é possível excluir agendamentos que ainda não fizeram check-in');
    }
    return prisma.yardVisit.delete({ where: { id } });
  }

  async checkIn(id: string, data: CheckInYardVisitDto) {
    const visit = await prisma.yardVisit.findUnique({ where: { id } });
    if (!visit) throw new AppError(404, 'Visita não encontrada');
    if (visit.status !== 'SCHEDULED') {
      throw new AppError(400, 'Só é possível fazer check-in de agendamentos pendentes');
    }

    await runCheckInValidations({ supplierId: visit.supplierId }, data.driverId, data.vehicleId);

    const updated = await prisma.yardVisit.update({
      where: { id },
      data: { status: 'CHECKED_IN', driverId: data.driverId, vehicleId: data.vehicleId, checkedInAt: new Date() },
    });

    return this.attachPunctuality(updated);
  }

  async cancel(id: string) {
    const visit = await prisma.yardVisit.findUnique({ where: { id } });
    if (!visit) throw new AppError(404, 'Visita não encontrada');
    if (visit.status === 'CANCELLED') {
      throw new AppError(400, 'Esta visita já está cancelada');
    }
    return prisma.yardVisit.update({ where: { id }, data: { status: 'CANCELLED' } });
  }
}

export default new YardVisitService();
