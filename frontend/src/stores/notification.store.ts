import { defineStore } from 'pinia';
import notificationService, { type Notification, type NotificationMetrics } from '@/services/notification.service';

interface NotificationState {
  notifications: Notification[];
  criticalNotifications: Notification[];
  unreadCount: number;
  priorityCounts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  metrics: NotificationMetrics | null;
  loading: boolean;
  error: string | null;
}

export const useNotificationStore = defineStore('notification', {
  state: (): NotificationState => ({
    notifications: [],
    criticalNotifications: [],
    unreadCount: 0,
    priorityCounts: {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    },
    metrics: null,
    loading: false,
    error: null,
  }),

  getters: {
    hasCritical: (state) => state.priorityCounts.critical > 0,
    hasUnread: (state) => state.unreadCount > 0,
    
    unreadNotifications: (state) => {
      return state.notifications.filter(n => !n.read && !n.archived);
    },

    notificationsByCategory: (state) => {
      return (category: string) => {
        return state.notifications.filter(n => n.category === category && !n.archived);
      };
    },
  },

  actions: {
    async fetchNotifications(filters?: any, page = 1, limit = 20) {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await notificationService.getAll(filters, page, limit);
        this.notifications = response.data.data;
        return response.data;
      } catch (error: any) {
        this.error = error.message || 'Erro ao carregar notificações';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async fetchCritical() {
      try {
        const response = await notificationService.getCritical();
        this.criticalNotifications = response.data.data;
      } catch (error: any) {
        console.error('Erro ao carregar notificações críticas:', error);
      }
    },

    async updateUnreadCount() {
      try {
        const response = await notificationService.countUnread();
        this.unreadCount = response.data.data.count;
      } catch (error: any) {
        console.error('Erro ao contar notificações:', error);
      }
    },

    async updatePriorityCounts() {
      try {
        const response = await notificationService.countByPriority();
        this.priorityCounts = response.data.data;
      } catch (error: any) {
        console.error('Erro ao contar por prioridade:', error);
      }
    },

    async markAsRead(id: string) {
      try {
        await notificationService.markAsRead(id);
        
        // Atualizar localmente
        const notification = this.notifications.find(n => n.id === id);
        if (notification) {
          notification.read = true;
          notification.readAt = new Date().toISOString();
        }
        
        // Atualizar contadores
        await this.updateUnreadCount();
        await this.updatePriorityCounts();
      } catch (error: any) {
        this.error = error.message || 'Erro ao marcar como lida';
        throw error;
      }
    },

    async markAllAsRead() {
      try {
        await notificationService.markAllAsRead();
        
        // Atualizar localmente
        this.notifications.forEach(n => {
          if (!n.read) {
            n.read = true;
            n.readAt = new Date().toISOString();
          }
        });
        
        // Atualizar contadores
        this.unreadCount = 0;
        await this.updatePriorityCounts();
      } catch (error: any) {
        this.error = error.message || 'Erro ao marcar todas como lidas';
        throw error;
      }
    },

    async archive(id: string) {
      try {
        await notificationService.archive(id);
        
        // Remover localmente
        const index = this.notifications.findIndex(n => n.id === id);
        if (index !== -1) {
          this.notifications.splice(index, 1);
        }
        
        // Atualizar contadores
        await this.updateUnreadCount();
        await this.updatePriorityCounts();
      } catch (error: any) {
        this.error = error.message || 'Erro ao arquivar notificação';
        throw error;
      }
    },

    async fetchMetrics(days = 7) {
      try {
        const response = await notificationService.getMetrics(days);
        this.metrics = response.data.data;
      } catch (error: any) {
        console.error('Erro ao carregar métricas:', error);
      }
    },

    async refreshAll() {
      await Promise.all([
        this.fetchCritical(),
        this.updateUnreadCount(),
        this.updatePriorityCounts(),
      ]);
    },

    // Adicionar nova notificação (para WebSocket no futuro)
    addNotification(notification: Notification) {
      this.notifications.unshift(notification);
      
      if (!notification.read) {
        this.unreadCount++;
      }
      
      if (notification.priority >= 3) {
        this.criticalNotifications.unshift(notification);
        if (notification.priority === 4) {
          this.priorityCounts.critical++;
        } else {
          this.priorityCounts.high++;
        }
      }
    },
  },
});
