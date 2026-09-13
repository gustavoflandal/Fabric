import { YardVisitStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';

export type PunctualityStatus = 'NO_HORARIO' | 'ANTECIPADO' | 'ATRASADO' | null;

export interface YardDashboardVisitRow {
  id: string;
  plate: string | null;
  driverName: string | null;
  vehicleModel: string | null;
  serviceType: 'RECEBIMENTO' | 'EXPEDICAO' | 'MULTIUSO';
  supplierName: string | null;
  origin: 'MANUAL' | 'PURCHASE_ORDER';
  currentLocation: 'PORTARIA' | 'PATIO' | 'DOCA' | 'CONCLUIDA' | 'CANCELADA';
  scheduledAt: Date;
  punctuality: PunctualityStatus;
  performedBy: string | null;
  notes: string | null;
  totalDurationMinutes: number | null;
}

const LOCATION_BY_STATUS: Record<string, YardDashboardVisitRow['currentLocation']> = {
  SCHEDULED: 'PORTARIA', // não aparece em modo tempo real (filtrado), mas PODE aparecer em modo histórico (que não filtra por status) — mantido no map por isso, não só por completude
  CHECKED_IN: 'PORTARIA',
  IN_YARD: 'PATIO',
  AT_DOCK: 'DOCA',
  COMPLETED: 'CONCLUIDA',
  CANCELLED: 'CANCELADA',
};

const VISIT_LIFECYCLE_ACTIONS = [
  'check-in', 'allocate-spot', 'move-to-dock', 'start-loading', 'end-loading', 'complete', 'cancel',
];
const VISIT_ID_IN_ENDPOINT = /\/yard-visits\/([a-f0-9-]{36})/i;

function computePunctuality(scheduledAt: Date, referenceTime: Date, toleranceMinutes: number): PunctualityStatus {
  const diffMinutes = (referenceTime.getTime() - scheduledAt.getTime()) / 60_000;
  if (Math.abs(diffMinutes) <= toleranceMinutes) return 'NO_HORARIO';
  return diffMinutes < 0 ? 'ANTECIPADO' : 'ATRASADO';
}

async function getLatestPerformerByVisit(visitIds: string[]): Promise<Map<string, string>> {
  if (visitIds.length === 0) return new Map();

  const logs = await prisma.auditLog.findMany({
    where: { resource: { in: VISIT_LIFECYCLE_ACTIONS } },
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { name: true } } },
  });

  const relevantIds = new Set(visitIds);
  const map = new Map<string, string>();
  for (const log of logs) {
    const match = log.endpoint?.match(VISIT_ID_IN_ENDPOINT);
    const visitId = match?.[1];
    if (visitId && relevantIds.has(visitId) && !map.has(visitId) && log.user) {
      map.set(visitId, log.user.name);
    }
  }
  return map;
}

export class YardDashboardService {
  async getDashboard(warehouseId: string, days?: number) {
    if (!warehouseId) {
      throw new AppError(400, 'Armazém é obrigatório');
    }

    const mode: 'REALTIME' | 'HISTORICAL' = days ? 'HISTORICAL' : 'REALTIME';
    const OPEN_STATUSES: YardVisitStatus[] = ['CHECKED_IN', 'IN_YARD', 'AT_DOCK'];
    // Em modo histórico, o filtro por `createdAt` sozinho deixaria de fora uma
    // visita que já está aberta (ex: AT_DOCK) mas começou ANTES da janela de
    // `days` — subestimando totals.patio/totals.doca (e a ocupação derivada
    // deles) em relação ao estado real agora. O `OR` garante que toda visita
    // atualmente aberta sempre entra, além de tudo criado dentro da janela.
    const where = days
      ? {
          warehouseId,
          OR: [
            { createdAt: { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) } },
            { status: { in: OPEN_STATUSES } },
          ],
        }
      : { warehouseId, status: { in: OPEN_STATUSES } };

    const [visits, params, activeSpots, activeDocks] = await Promise.all([
      prisma.yardVisit.findMany({
        where,
        include: { supplier: true, driver: true, vehicle: true },
        orderBy: { scheduledAt: 'desc' },
      }),
      prisma.yardWarehouseParams.findUnique({ where: { warehouseId } }),
      prisma.yardSpot.count({ where: { active: true, blocked: false, area: { warehouseId, active: true, blocked: false } } }),
      prisma.yardDock.count({ where: { warehouseId, active: true } }),
    ]);

    const toleranceMinutes = params?.delayToleranceMinutes ?? 15;

    const totals = {
      portaria: visits.filter((v) => v.status === 'CHECKED_IN').length,
      patio: visits.filter((v) => v.status === 'IN_YARD').length,
      doca: visits.filter((v) => v.status === 'AT_DOCK').length,
    };

    const occupancy = {
      patioPercent: activeSpots > 0 ? Math.round((totals.patio / activeSpots) * 100) : null,
      docaPercent: activeDocks > 0 ? Math.round((totals.doca / activeDocks) * 100) : null,
      patioRatio: activeSpots > 0 ? `${totals.patio}/${activeSpots}` : null,
      docaRatio: activeDocks > 0 ? `${totals.doca}/${activeDocks}` : null,
    };

    const performedByMap = await getLatestPerformerByVisit(visits.map((v) => v.id));

    const rows: YardDashboardVisitRow[] = visits.map((v) => ({
      id: v.id,
      plate: v.vehicle?.plate ?? null,
      driverName: v.driver?.name ?? null,
      vehicleModel: v.vehicle?.model ?? null,
      serviceType: v.serviceType as YardDashboardVisitRow['serviceType'],
      supplierName: v.supplier?.name ?? null,
      origin: v.purchaseOrderId ? 'PURCHASE_ORDER' : 'MANUAL',
      currentLocation: LOCATION_BY_STATUS[v.status],
      scheduledAt: v.scheduledAt,
      punctuality:
        v.status === 'CANCELLED'
          ? null
          : computePunctuality(v.scheduledAt, v.checkedInAt ?? v.completedAt ?? new Date(), toleranceMinutes),
      performedBy: performedByMap.get(v.id) ?? null,
      notes: v.notes,
      totalDurationMinutes:
        v.status === 'COMPLETED' && v.checkedInAt && v.completedAt
          ? Math.round((v.completedAt.getTime() - v.checkedInAt.getTime()) / 60_000)
          : null,
    }));

    return { mode, totals, occupancy, visits: rows };
  }
}

export default new YardDashboardService();
