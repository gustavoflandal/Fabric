import { WarehouseTaskStatus, WarehouseTaskType } from '@prisma/client';
import { prisma } from '../config/database';
import { getSetting } from './system-setting.service';
import { OPEN_STATUSES, RECEIPT_TASK_REFERENCE_TYPE } from './warehouse-task.service';

/**
 * Dashboard de KPIs do WMS — as 4 abas sobre a cadeia de Recebimento
 * (Volume/Status, Tempo de Ciclo, Produtividade, Gargalos). A aba de
 * Ocupação (StoragePosition) mora em storage-position.service.ts, domínio de
 * dados diferente — ver docs/superpowers/specs/2026-09-05-dashboard-kpis-wms-design.md.
 */

const MS_PER_HOUR = 60 * 60 * 1000;

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export interface VolumeStatusEntry {
  type: WarehouseTaskType;
  status: WarehouseTaskStatus;
  count: number;
}

export interface VolumeStatus {
  byTypeAndStatus: VolumeStatusEntry[];
  receiptsActive: number;
  receiptsFinished: number;
}

export interface CycleTimeByType {
  type: WarehouseTaskType;
  avgHours: number;
}

export interface CycleTime {
  byType: CycleTimeByType[];
  fullReceiptAvgHours: number;
}

export interface ProductivityEntry {
  userId: string;
  userName: string;
  tasksCompleted: number;
  avgExecutionHours: number;
}

export interface BottleneckByType {
  type: WarehouseTaskType;
  count: number;
}

export interface BottleneckAffected {
  receiptId: string;
  receiptNumber: string;
  taskType: WarehouseTaskType;
  hoursStuck: number;
}

export interface Bottlenecks {
  byType: BottleneckByType[];
  affected: BottleneckAffected[];
}

export interface WmsTaskKpis {
  period: { days: number };
  volumeStatus: VolumeStatus;
  cycleTime: CycleTime;
  productivity: ProductivityEntry[];
  bottlenecks: Bottlenecks;
}

async function getVolumeStatus(since: Date): Promise<VolumeStatus> {
  const grouped = await prisma.warehouseTask.groupBy({
    by: ['type', 'status'],
    where: { referenceType: RECEIPT_TASK_REFERENCE_TYPE, createdAt: { gte: since } },
    _count: { id: true },
  });
  const byTypeAndStatus = grouped.map((g) => ({ type: g.type, status: g.status, count: g._count.id }));

  const allRefs = await prisma.warehouseTask.findMany({
    where: { referenceType: RECEIPT_TASK_REFERENCE_TYPE, createdAt: { gte: since } },
    select: { reference: true },
    distinct: ['reference'],
  });
  const activeRefs = await prisma.warehouseTask.findMany({
    where: {
      referenceType: RECEIPT_TASK_REFERENCE_TYPE,
      createdAt: { gte: since },
      status: { in: OPEN_STATUSES },
    },
    select: { reference: true },
    distinct: ['reference'],
  });
  const activeSet = new Set(activeRefs.map((r) => r.reference).filter((r): r is string => !!r));
  const receiptsActive = activeSet.size;
  const receiptsFinished = allRefs.filter((r) => r.reference && !activeSet.has(r.reference)).length;

  return { byTypeAndStatus, receiptsActive, receiptsFinished };
}

async function getCycleTime(since: Date): Promise<CycleTime> {
  // Passo 1: recebimentos com QUALQUER atividade recente (tarefa concluída
  // dentro do período) — leve, só `reference` distinto. Isso decide QUAIS
  // cadeias importam para esta consulta, sem carregar a tabela inteira.
  const recentReceipts = await prisma.warehouseTask.findMany({
    where: {
      referenceType: RECEIPT_TASK_REFERENCE_TYPE,
      status: WarehouseTaskStatus.COMPLETED,
      completedAt: { gte: since },
    },
    select: { reference: true },
    distinct: ['reference'],
  });
  const candidateReferences = recentReceipts
    .map((r) => r.reference)
    .filter((r): r is string => !!r);

  // Passo 2: a cadeia COMPLETA (qualquer status, qualquer data) só dessas
  // referências — necessário porque fullReceiptAvgHours precisa do
  // createdAt mais antigo da cadeia inteira, que pode ser anterior a `since`.
  const tasks =
    candidateReferences.length === 0
      ? []
      : await prisma.warehouseTask.findMany({
          where: { referenceType: RECEIPT_TASK_REFERENCE_TYPE, reference: { in: candidateReferences } },
          select: { type: true, status: true, reference: true, createdAt: true, completedAt: true },
        });

  const hoursByType = new Map<WarehouseTaskType, number[]>();
  for (const task of tasks) {
    if (task.status !== WarehouseTaskStatus.COMPLETED || !task.completedAt) continue;
    if (task.completedAt < since) continue;
    const hours = (task.completedAt.getTime() - task.createdAt.getTime()) / MS_PER_HOUR;
    const list = hoursByType.get(task.type) ?? [];
    list.push(hours);
    hoursByType.set(task.type, list);
  }
  const byType: CycleTimeByType[] = [...hoursByType.entries()].map(([type, hours]) => ({
    type,
    avgHours: round1(average(hours)),
  }));

  const byReceipt = new Map<string, typeof tasks>();
  for (const task of tasks) {
    if (!task.reference) continue;
    const list = byReceipt.get(task.reference) ?? [];
    list.push(task);
    byReceipt.set(task.reference, list);
  }

  const fullReceiptHours: number[] = [];
  for (const receiptTasks of byReceipt.values()) {
    const stillOpen = receiptTasks.some((t) => OPEN_STATUSES.includes(t.status));
    if (stillOpen) continue;
    const completedOnes = receiptTasks.filter(
      (t): t is typeof t & { completedAt: Date } => t.completedAt !== null
    );
    if (completedOnes.length === 0) continue;
    const earliestCreated = Math.min(...receiptTasks.map((t) => t.createdAt.getTime()));
    const latestCompleted = Math.max(...completedOnes.map((t) => t.completedAt.getTime()));
    if (latestCompleted < since.getTime()) continue;
    fullReceiptHours.push((latestCompleted - earliestCreated) / MS_PER_HOUR);
  }

  return { byType, fullReceiptAvgHours: round1(average(fullReceiptHours)) };
}

async function getProductivity(since: Date): Promise<ProductivityEntry[]> {
  const tasks = await prisma.warehouseTask.findMany({
    where: {
      referenceType: RECEIPT_TASK_REFERENCE_TYPE,
      status: WarehouseTaskStatus.COMPLETED,
      completedAt: { gte: since },
      assignedTo: { not: null },
      startedAt: { not: null },
    },
    select: { assignedTo: true, startedAt: true, completedAt: true },
  });

  const byUser = new Map<string, { count: number; hours: number[] }>();
  for (const task of tasks) {
    if (!task.assignedTo || !task.startedAt || !task.completedAt) continue;
    const entry = byUser.get(task.assignedTo) ?? { count: 0, hours: [] };
    entry.count += 1;
    entry.hours.push((task.completedAt.getTime() - task.startedAt.getTime()) / MS_PER_HOUR);
    byUser.set(task.assignedTo, entry);
  }

  const userIds = [...byUser.keys()];
  if (userIds.length === 0) return [];

  const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } });
  const nameById = new Map(users.map((u) => [u.id, u.name]));

  return userIds
    .map((userId) => {
      const entry = byUser.get(userId)!;
      return {
        userId,
        userName: nameById.get(userId) ?? 'Desconhecido',
        tasksCompleted: entry.count,
        avgExecutionHours: round1(average(entry.hours)),
      };
    })
    .sort((a, b) => b.tasksCompleted - a.tasksCompleted);
}

async function getBottlenecks(): Promise<Bottlenecks> {
  const thresholdHours = await getSetting('wms.task_delay_threshold_hours', 24);
  const cutoff = new Date(Date.now() - thresholdHours * MS_PER_HOUR);

  const stuckTasks = await prisma.warehouseTask.findMany({
    where: {
      referenceType: RECEIPT_TASK_REFERENCE_TYPE,
      status: { in: OPEN_STATUSES },
      createdAt: { lt: cutoff },
    },
    select: { type: true, reference: true, createdAt: true },
  });

  const byTypeMap = new Map<WarehouseTaskType, number>();
  for (const task of stuckTasks) {
    byTypeMap.set(task.type, (byTypeMap.get(task.type) ?? 0) + 1);
  }
  const byType = [...byTypeMap.entries()].map(([type, count]) => ({ type, count }));

  const receiptIds = [...new Set(stuckTasks.map((t) => t.reference).filter((r): r is string => r !== null))];
  const receipts =
    receiptIds.length > 0
      ? await prisma.purchaseReceipt.findMany({
          where: { id: { in: receiptIds } },
          select: { id: true, receiptNumber: true },
        })
      : [];
  const receiptById = new Map(receipts.map((r) => [r.id, r.receiptNumber]));

  const affected = stuckTasks
    .filter((t): t is typeof t & { reference: string } => t.reference !== null)
    .map((t) => ({
      receiptId: t.reference,
      receiptNumber: receiptById.get(t.reference) ?? '—',
      taskType: t.type,
      hoursStuck: round1((Date.now() - t.createdAt.getTime()) / MS_PER_HOUR),
    }))
    .sort((a, b) => b.hoursStuck - a.hoursStuck);

  return { byType, affected };
}

export async function getTaskKpis(days: number): Promise<WmsTaskKpis> {
  const since = new Date(Date.now() - days * 24 * MS_PER_HOUR);

  const [volumeStatus, cycleTime, productivity, bottlenecks] = await Promise.all([
    getVolumeStatus(since),
    getCycleTime(since),
    getProductivity(since),
    getBottlenecks(),
  ]);

  return { period: { days }, volumeStatus, cycleTime, productivity, bottlenecks };
}
