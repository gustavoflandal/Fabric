import { MaintenanceOrderStatus, MaintenanceOrderType } from '@prisma/client';
import { prisma } from '../config/database';

const MS_PER_HOUR = 60 * 60 * 1000;

function average(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export interface MtbfEntry {
  equipmentId: string;
  equipmentCode: string;
  equipmentName: string;
  /** `null` quando o equipamento tem menos de 2 corretivas no histórico — não é "zero falhas", é "dado insuficiente". */
  mtbfHours: number | null;
}

export interface OrdersByStatusAndType {
  status: MaintenanceOrderStatus;
  type: MaintenanceOrderType;
  count: number;
}

export interface MaintenanceKpis {
  /** `null` quando não há nenhuma ordem COMPLETED com startedAt/completedAt no histórico. */
  mttrHours: number | null;
  mtbfByEquipment: MtbfEntry[];
  /** % de MaintenancePlan ativos cujo nextDueDate atual está no futuro. */
  preventiveComplianceRate: number;
  ordersByStatusAndType: OrdersByStatusAndType[];
}

/**
 * MTTR (tempo médio de reparo): média de completedAt-startedAt entre TODAS as
 * ordens COMPLETED (preventivas e corretivas) — mesmo padrão de delta de
 * timestamp de wms-kpi.service.ts.
 */
async function computeMttr(): Promise<number | null> {
  const completedOrders = await prisma.maintenanceOrder.findMany({
    where: { status: 'COMPLETED', startedAt: { not: null }, completedAt: { not: null } },
    select: { startedAt: true, completedAt: true },
  });

  if (completedOrders.length === 0) return null;

  const hours = completedOrders.map(
    (o) => (o.completedAt!.getTime() - o.startedAt!.getTime()) / MS_PER_HOUR
  );
  return round1(average(hours));
}

/**
 * MTBF (tempo médio entre falhas), por equipamento: média dos intervalos
 * entre createdAt de ordens CORRECTIVE consecutivas daquele equipamento.
 * Exige pelo menos 2 corretivas para produzir um valor.
 */
async function computeMtbfByEquipment(): Promise<MtbfEntry[]> {
  const equipmentList = await prisma.equipment.findMany({
    select: { id: true, code: true, name: true },
    orderBy: { name: 'asc' },
  });

  const correctiveOrders = await prisma.maintenanceOrder.findMany({
    where: { type: 'CORRECTIVE' },
    select: { equipmentId: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  const byEquipment = new Map<string, Date[]>();
  for (const order of correctiveOrders) {
    const list = byEquipment.get(order.equipmentId) ?? [];
    list.push(order.createdAt);
    byEquipment.set(order.equipmentId, list);
  }

  return equipmentList.map((equipment) => {
    const timestamps = byEquipment.get(equipment.id) ?? [];
    if (timestamps.length < 2) {
      return {
        equipmentId: equipment.id,
        equipmentCode: equipment.code,
        equipmentName: equipment.name,
        mtbfHours: null,
      };
    }

    const gaps: number[] = [];
    for (let i = 1; i < timestamps.length; i += 1) {
      gaps.push((timestamps[i].getTime() - timestamps[i - 1].getTime()) / MS_PER_HOUR);
    }

    return {
      equipmentId: equipment.id,
      equipmentCode: equipment.code,
      equipmentName: equipment.name,
      mtbfHours: round1(average(gaps)),
    };
  });
}

async function computePreventiveComplianceRate(): Promise<number> {
  const activePlans = await prisma.maintenancePlan.findMany({
    where: { active: true },
    select: { nextDueDate: true },
  });

  if (activePlans.length === 0) return 100;

  const now = new Date();
  const notOverdue = activePlans.filter((p) => p.nextDueDate.getTime() > now.getTime()).length;
  return round1((notOverdue / activePlans.length) * 100);
}

async function computeOrdersByStatusAndType(): Promise<OrdersByStatusAndType[]> {
  const grouped = await prisma.maintenanceOrder.groupBy({
    by: ['status', 'type'],
    _count: { _all: true },
  });

  return grouped.map((g) => ({ status: g.status, type: g.type, count: g._count._all }));
}

export async function getMaintenanceKpis(): Promise<MaintenanceKpis> {
  const [mttrHours, mtbfByEquipment, preventiveComplianceRate, ordersByStatusAndType] = await Promise.all([
    computeMttr(),
    computeMtbfByEquipment(),
    computePreventiveComplianceRate(),
    computeOrdersByStatusAndType(),
  ]);

  return { mttrHours, mtbfByEquipment, preventiveComplianceRate, ordersByStatusAndType };
}
