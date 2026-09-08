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
  period: { days: number };
  /** `null` quando não há nenhuma ordem COMPLETED com startedAt/completedAt no histórico. */
  mttrHours: number | null;
  mtbfByEquipment: MtbfEntry[];
  /** % de MaintenancePlan ativos cujo nextDueDate atual está no futuro. */
  preventiveComplianceRate: number;
  ordersByStatusAndType: OrdersByStatusAndType[];
}

/** Máximo de linhas retornadas em `mtbfByEquipment` (top piores MTBF primeiro). */
const MTBF_TOP_N = 20;

/**
 * MTTR (tempo médio de reparo): média de completedAt-startedAt entre as
 * ordens COMPLETED (preventivas e corretivas) concluídas dentro da janela de
 * `since` — mesmo padrão de delta de timestamp de wms-kpi.service.ts.
 * `completedAt: { gte: since }` já exclui `null` (NULL >= X é falso em SQL),
 * então não precisa de um `not: null` explícito.
 */
async function computeMttr(since: Date): Promise<number | null> {
  const completedOrders = await prisma.maintenanceOrder.findMany({
    where: { status: 'COMPLETED', startedAt: { not: null }, completedAt: { gte: since } },
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
 * entre createdAt de ordens CORRECTIVE consecutivas, dentro da janela de
 * `since`, daquele equipamento. Exige pelo menos 2 corretivas no período para
 * produzir um valor. A lista final é limitada a `MTBF_TOP_N` equipamentos,
 * ordenada por mtbfHours ascendente (pior MTBF primeiro) — equipamentos sem
 * dado suficiente (`null`) ficam por último, para não afogar o dashboard com
 * centenas de linhas quando o parque de equipamentos é grande.
 */
async function computeMtbfByEquipment(since: Date): Promise<MtbfEntry[]> {
  const equipmentList = await prisma.equipment.findMany({
    select: { id: true, code: true, name: true },
    orderBy: { name: 'asc' },
  });

  const correctiveOrders = await prisma.maintenanceOrder.findMany({
    where: { type: 'CORRECTIVE', createdAt: { gte: since } },
    select: { equipmentId: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  const byEquipment = new Map<string, Date[]>();
  for (const order of correctiveOrders) {
    const list = byEquipment.get(order.equipmentId) ?? [];
    list.push(order.createdAt);
    byEquipment.set(order.equipmentId, list);
  }

  const entries = equipmentList.map((equipment) => {
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

  return entries
    .sort((a, b) => {
      if (a.mtbfHours === null && b.mtbfHours === null) return 0;
      if (a.mtbfHours === null) return 1;
      if (b.mtbfHours === null) return -1;
      return a.mtbfHours - b.mtbfHours;
    })
    .slice(0, MTBF_TOP_N);
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

/**
 * Deliberadamente SEM filtro de período (Fix 4 da revisão final, decisão de
 * julgamento registrada em `.superpowers/sdd/final-review-fixes-report.md`):
 * é uma contagem de STATUS ATUAL das ordens (quantas estão PENDING/
 * IN_PROGRESS/COMPLETED/CANCELLED agora), não uma série histórica — mesmo
 * critério já aplicado a `computePreventiveComplianceRate()`, que também
 * reflete o estado atual dos planos, não o histórico dentro de `days`.
 */
async function computeOrdersByStatusAndType(): Promise<OrdersByStatusAndType[]> {
  const grouped = await prisma.maintenanceOrder.groupBy({
    by: ['status', 'type'],
    _count: { _all: true },
  });

  return grouped.map((g) => ({ status: g.status, type: g.type, count: g._count._all }));
}

export async function getMaintenanceKpis(days: number = 90): Promise<MaintenanceKpis> {
  const since = new Date(Date.now() - days * 24 * MS_PER_HOUR);

  const [mttrHours, mtbfByEquipment, preventiveComplianceRate, ordersByStatusAndType] = await Promise.all([
    computeMttr(since),
    computeMtbfByEquipment(since),
    computePreventiveComplianceRate(),
    computeOrdersByStatusAndType(),
  ]);

  return { period: { days }, mttrHours, mtbfByEquipment, preventiveComplianceRate, ordersByStatusAndType };
}
