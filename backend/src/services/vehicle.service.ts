import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';

export interface CreateVehicleDto {
  plate: string;
  type: 'TRUCK' | 'TOCO' | 'CAVALO' | 'MECANICO' | 'VAN' | 'UTILITARIO' | 'OUTROS';
  model?: string | null;
  supplierId: string;
  fleetId?: string | null;
}

export interface UpdateVehicleDto extends Partial<CreateVehicleDto> {}

export interface VehicleFilters {
  supplierId?: string;
  fleetId?: string;
  type?: CreateVehicleDto['type'];
  blocked?: boolean;
  search?: string;
}

const PLATE_PATTERN = /^([A-Z]{3}\d[A-Z]\d{2}|[A-Z]{3}\d{4})$/;

const normalizePlate = (plate: string): string => {
  const normalized = plate.trim().toUpperCase();
  if (!PLATE_PATTERN.test(normalized)) {
    throw new AppError(400, 'Placa em formato inválido (use ABC1234 ou ABC1D23, sem hífen)');
  }
  return normalized;
};

const assertSupplierExists = async (supplierId: string) => {
  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) {
    throw new AppError(400, 'Fornecedor informado não existe');
  }
};

const assertFleetBelongsToSupplier = async (fleetId: string, supplierId: string) => {
  const fleet = await prisma.fleet.findUnique({ where: { id: fleetId } });
  if (!fleet) {
    throw new AppError(400, 'Frota informada não existe');
  }
  if (fleet.supplierId !== supplierId) {
    throw new AppError(400, 'A frota informada pertence a outro fornecedor');
  }
};

const assertPlateNotTaken = async (plate: string, excludeId?: string) => {
  const existing = await prisma.vehicle.findFirst({
    where: { plate, ...(excludeId ? { id: { not: excludeId } } : {}) },
  });
  if (existing) {
    throw new AppError(400, 'Já existe um veículo cadastrado com esta placa');
  }
};

export class VehicleService {
  async create(data: CreateVehicleDto) {
    const plate = normalizePlate(data.plate);
    await assertSupplierExists(data.supplierId);
    if (data.fleetId) {
      await assertFleetBelongsToSupplier(data.fleetId, data.supplierId);
    }
    await assertPlateNotTaken(plate);
    return prisma.vehicle.create({ data: { ...data, plate } });
  }

  async getAll(page = 1, limit = 100, filters?: VehicleFilters) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filters?.supplierId) where.supplierId = filters.supplierId;
    if (filters?.fleetId) where.fleetId = filters.fleetId;
    if (filters?.type) where.type = filters.type;
    if (filters?.blocked !== undefined) where.blocked = filters.blocked;
    if (filters?.search) where.plate = { contains: filters.search.toUpperCase() };

    const [vehicles, total] = await Promise.all([
      prisma.vehicle.findMany({
        where,
        skip,
        take: limit,
        orderBy: { plate: 'asc' },
        include: {
          supplier: { select: { id: true, code: true, name: true } },
          fleet: { select: { id: true, name: true } },
        },
      }),
      prisma.vehicle.count({ where }),
    ]);

    return { data: vehicles, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async getById(id: string) {
    return prisma.vehicle.findUnique({
      where: { id },
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        fleet: { select: { id: true, name: true } },
      },
    });
  }

  async update(id: string, data: UpdateVehicleDto) {
    const current = await prisma.vehicle.findUnique({ where: { id } });
    if (!current) throw new AppError(404, 'Veículo não encontrado');

    const plate = data.plate ? normalizePlate(data.plate) : undefined;
    const supplierId = data.supplierId ?? current.supplierId;

    if (data.fleetId) {
      await assertFleetBelongsToSupplier(data.fleetId, supplierId);
    }
    if (data.supplierId) {
      await assertSupplierExists(data.supplierId);
    }
    if (plate) {
      await assertPlateNotTaken(plate, id);
    }

    return prisma.vehicle.update({ where: { id }, data: { ...data, ...(plate ? { plate } : {}) } });
  }

  async delete(id: string) {
    return prisma.vehicle.delete({ where: { id } });
  }

  async setBlocked(id: string, blocked: boolean, blockedReason: string | null) {
    return prisma.vehicle.update({ where: { id }, data: { blocked, blockedReason: blocked ? blockedReason : null } });
  }
}

export default new VehicleService();
