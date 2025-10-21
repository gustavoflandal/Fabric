import api from './api.service';

export interface Notification {
  id: string;
  userId: string;
  type: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';
  category: 'PRODUCTION' | 'STOCK' | 'PURCHASE' | 'QUALITY' | 'CAPACITY';
  eventType: string;
  title: string;
  message: string;
  data?: any;
  link?: string;
  resourceType?: string;
  resourceId?: string;
  read: boolean;
  readAt?: string;
  archived: boolean;
  archivedAt?: string;
  priority: number;
  expiresAt?: string;
  createdAt: string;
}

export interface NotificationMetrics {
  totalUnread: number;
  criticalCount: number;
  highCount: number;
  byCategory: Record<string, number>;
  dailyTrend: Array<{
    date: string;
    count: number;
    critical: number;
  }>;
  topEvents: Array<{
    eventType: string;
    count: number;
  }>;
}

class NotificationService {
  private readonly basePath = '/notifications';

  async getAll(filters?: {
    category?: string;
    priority?: number;
    read?: boolean;
    archived?: boolean;
  }, page = 1, limit = 20) {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    
    if (filters?.category) params.append('category', filters.category);
    if (filters?.priority) params.append('priority', filters.priority.toString());
    if (filters?.read !== undefined) params.append('read', filters.read.toString());
    if (filters?.archived !== undefined) params.append('archived', filters.archived.toString());
    
    return api.get(`${this.basePath}?${params.toString()}`);
  }

  async getCritical() {
    return api.get(`${this.basePath}/critical`);
  }

  async countUnread() {
    return api.get(`${this.basePath}/count/unread`);
  }

  async countByPriority() {
    return api.get(`${this.basePath}/count/priority`);
  }

  async markAsRead(id: string) {
    return api.patch(`${this.basePath}/${id}/read`, {});
  }

  async markAllAsRead() {
    return api.patch(`${this.basePath}/read-all`, {});
  }

  async archive(id: string) {
    return api.patch(`${this.basePath}/${id}/archive`, {});
  }

  async getMetrics(days = 7) {
    return api.get(`${this.basePath}/metrics?days=${days}`);
  }
}

export default new NotificationService();
