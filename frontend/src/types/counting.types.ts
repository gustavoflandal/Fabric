// Enums
export enum LocationType {
  WAREHOUSE = 'WAREHOUSE',
  AREA = 'AREA',
  CORRIDOR = 'CORRIDOR',
  SHELF = 'SHELF',
  BIN = 'BIN',
  FLOOR = 'FLOOR',
}

export enum CountingType {
  CYCLIC = 'CYCLIC',
  SPOT = 'SPOT',
  FULL_INVENTORY = 'FULL_INVENTORY',
  BLIND = 'BLIND',
}

export enum CountingFrequency {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  BIWEEKLY = 'BIWEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  SEMIANNUAL = 'SEMIANNUAL',
  ANNUAL = 'ANNUAL',
  ON_DEMAND = 'ON_DEMAND',
}

export enum CountingPlanStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum SessionStatus {
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum CountingItemStatus {
  PENDING = 'PENDING',
  COUNTED = 'COUNTED',
  RECOUNTED = 'RECOUNTED',
  ADJUSTED = 'ADJUSTED',
  CANCELLED = 'CANCELLED',
}

// Interfaces
export interface Location {
  id: string;
  code: string;
  name: string;
  type: LocationType;
  parentId?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  parent?: Location;
  children?: Location[];
}

export interface CountingPlan {
  id: string;
  code: string;
  name: string;
  description?: string;
  type: CountingType;
  frequency?: CountingFrequency;
  status: CountingPlanStatus;
  criteria?: any;
  allowBlindCount: boolean;
  requireRecount: boolean;
  tolerancePercent?: number;
  toleranceQty?: number;
  startDate: string;
  endDate?: string;
  nextExecution?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  creator?: {
    id: string;
    name: string;
    email: string;
  };
  _count?: {
    sessions: number;
  };
}

export interface CountingSession {
  id: string;
  code: string;
  planId: string;
  status: SessionStatus;
  scheduledDate: string;
  startedAt?: string;
  completedAt?: string;
  assignedTo?: string;
  completedBy?: string;
  totalItems: number;
  countedItems: number;
  itemsWithDiff: number;
  accuracyPercent?: number;
  createdAt: string;
  updatedAt: string;
  plan?: {
    id: string;
    code: string;
    name: string;
    type: CountingType;
  };
  assignedUser?: {
    id: string;
    name: string;
    email: string;
  };
  completedUser?: {
    id: string;
    name: string;
    email: string;
  };
  items?: CountingItem[];
}

export interface CountingItem {
  id: string;
  sessionId: string;
  productId: string;
  locationId?: string;
  systemQty: number;
  countedQty?: number;
  recountQty?: number;
  finalQty?: number;
  difference?: number;
  differencePercent?: number;
  hasDifference: boolean;
  status: CountingItemStatus;
  notes?: string;
  reason?: string;
  countedBy?: string;
  countedAt?: string;
  recountedBy?: string;
  recountedAt?: string;
  createdAt: string;
  updatedAt: string;
  product?: {
    id: string;
    code: string;
    name: string;
    type: string;
    unitId: string;
  };
  location?: Location;
  counter?: {
    id: string;
    name: string;
  };
  recounter?: {
    id: string;
    name: string;
  };
  session?: CountingSession;
}

// DTOs
export interface CreateCountingPlanDTO {
  name: string;
  description?: string;
  type: CountingType;
  frequency?: CountingFrequency;
  criteria?: any;
  allowBlindCount?: boolean;
  requireRecount?: boolean;
  tolerancePercent?: number;
  toleranceQty?: number;
  startDate: string;
  endDate?: string;
}

export interface UpdateCountingPlanDTO {
  name?: string;
  description?: string;
  type?: CountingType;
  frequency?: CountingFrequency;
  criteria?: any;
  allowBlindCount?: boolean;
  requireRecount?: boolean;
  tolerancePercent?: number;
  toleranceQty?: number;
  startDate?: string;
  endDate?: string;
}

export interface CreateSessionDTO {
  planId: string;
  scheduledDate: string;
  assignedTo?: string;
}

export interface CountItemDTO {
  countedQty: number;
  notes?: string;
}

export interface RecountItemDTO {
  recountQty: number;
  notes?: string;
}

export interface CountingPlanFilters {
  status?: CountingPlanStatus;
  type?: CountingType;
  frequency?: CountingFrequency;
  search?: string;
}

export interface SessionFilters {
  status?: SessionStatus;
  planId?: string;
  assignedTo?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface ItemFilters {
  sessionId?: string;
  status?: CountingItemStatus;
  hasDifference?: boolean;
  productId?: string;
}

export interface CountingDashboard {
  stats: {
    activePlans: number;
    activeSessions: number;
    pendingItems: number;
    avgAccuracy: string;
  };
  scheduledToday: CountingSession[];
  recentDivergences: CountingItem[];
}

export interface CountingReport {
  session: {
    code: string;
    planName: string;
    scheduledDate: string;
    completedAt?: string;
    assignedUser?: string;
    completedUser?: string;
  };
  summary: {
    totalItems: number;
    countedItems: number;
    itemsWithDiff: number;
    accuracyPercent?: number;
    totalDifferenceValue: number;
  };
  divergences: Array<{
    product: {
      code: string;
      name: string;
      type: string;
    };
    systemQty: number;
    countedQty?: number;
    finalQty?: number;
    difference?: number;
    differencePercent?: number;
    status: CountingItemStatus;
    notes?: string;
    reason?: string;
  }>;
  analysis: {
    shortages: {
      count: number;
      items: Array<{
        product: string;
        difference: number;
      }>;
    };
    surpluses: {
      count: number;
      items: Array<{
        product: string;
        difference: number;
      }>;
    };
  };
}

// Labels para exibição
export const CountingTypeLabels: Record<CountingType, string> = {
  [CountingType.CYCLIC]: 'Cíclica',
  [CountingType.SPOT]: 'Pontual',
  [CountingType.FULL_INVENTORY]: 'Inventário Completo',
  [CountingType.BLIND]: 'Contagem Cega',
};

export const CountingFrequencyLabels: Record<CountingFrequency, string> = {
  [CountingFrequency.DAILY]: 'Diária',
  [CountingFrequency.WEEKLY]: 'Semanal',
  [CountingFrequency.BIWEEKLY]: 'Quinzenal',
  [CountingFrequency.MONTHLY]: 'Mensal',
  [CountingFrequency.QUARTERLY]: 'Trimestral',
  [CountingFrequency.SEMIANNUAL]: 'Semestral',
  [CountingFrequency.ANNUAL]: 'Anual',
  [CountingFrequency.ON_DEMAND]: 'Sob Demanda',
};

export const CountingPlanStatusLabels: Record<CountingPlanStatus, string> = {
  [CountingPlanStatus.DRAFT]: 'Rascunho',
  [CountingPlanStatus.ACTIVE]: 'Ativo',
  [CountingPlanStatus.PAUSED]: 'Pausado',
  [CountingPlanStatus.COMPLETED]: 'Concluído',
  [CountingPlanStatus.CANCELLED]: 'Cancelado',
};

export const SessionStatusLabels: Record<SessionStatus, string> = {
  [SessionStatus.SCHEDULED]: 'Agendada',
  [SessionStatus.IN_PROGRESS]: 'Em Andamento',
  [SessionStatus.COMPLETED]: 'Concluída',
  [SessionStatus.CANCELLED]: 'Cancelada',
};

export const CountingItemStatusLabels: Record<CountingItemStatus, string> = {
  [CountingItemStatus.PENDING]: 'Pendente',
  [CountingItemStatus.COUNTED]: 'Contado',
  [CountingItemStatus.RECOUNTED]: 'Recontado',
  [CountingItemStatus.ADJUSTED]: 'Ajustado',
  [CountingItemStatus.CANCELLED]: 'Cancelado',
};
