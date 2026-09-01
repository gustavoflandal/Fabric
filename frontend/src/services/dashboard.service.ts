import api from './api.service';

class DashboardService {
  private readonly basePath = '/dashboard';

  async getStatistics() {
    return api.get(`${this.basePath}/statistics`);
  }

  async getProductionMetrics() {
    return api.get(`${this.basePath}/production-metrics`);
  }

  async getWorkCenterMetrics() {
    return api.get(`${this.basePath}/work-center-metrics`);
  }

  async getTopProducts(limit = 5) {
    return api.get(`${this.basePath}/top-products?limit=${limit}`);
  }

  async getRecentActivity(limit = 10) {
    return api.get(`${this.basePath}/recent-activity?limit=${limit}`);
  }

  async getProductionTrend(days = 7) {
    return api.get(`${this.basePath}/production-trend?days=${days}`);
  }
}

export default new DashboardService();
