import api from './api.service';

export interface AuditLog {
  id: string;
  userId: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  description: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  method: string | null;
  endpoint: string | null;
  statusCode: number | null;
  requestBody: any;
  responseBody: any;
  oldValues: any;
  newValues: any;
  errorMessage: string | null;
  durationMs: number | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export interface AuditLogFilters {
  userId?: string;
  resource?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
}

export interface AuditLogStatistics {
  totalLogs: number;
  byAction: Array<{ action: string; count: number }>;
  byResource: Array<{ resource: string; count: number }>;
  topUsers: Array<{ userId: string; count: number }>;
}

class AuditLogService {
  async getAll(page = 1, limit = 100, filters?: AuditLogFilters) {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    if (filters?.userId) params.append('userId', filters.userId);
    if (filters?.resource) params.append('resource', filters.resource);
    if (filters?.action) params.append('action', filters.action);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);

    const response = await api.get(`/audit-logs?${params.toString()}`);
    return response.data;
  }

  async getById(id: string) {
    const response = await api.get(`/audit-logs/${id}`);
    return response.data;
  }

  async getByResource(resource: string, resourceId: string) {
    const response = await api.get(`/audit-logs/resource/${resource}/${resourceId}`);
    return response.data;
  }

  async getStatistics(startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const response = await api.get(`/audit-logs/statistics?${params.toString()}`);
    return response.data;
  }

  async deleteLogs(startDate: string, endDate: string) {
    const response = await api.delete('/audit-logs/clean', {
      data: { startDate, endDate }
    });
    return response.data;
  }
}

export default new AuditLogService();
