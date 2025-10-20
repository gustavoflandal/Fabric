import api from './api.service';

export interface ProductionReport {
  period: { start: string; end: string };
  summary: {
    total: number;
    completed: number;
    inProgress: number;
    planned: number;
    cancelled: number;
    totalPlanned: number;
    totalProduced: number;
    totalScrap: number;
    efficiency: number;
    scrapRate: number;
  };
  orders: any[];
  byProduct: any[];
}

export interface EfficiencyReport {
  period: { start: string; end: string };
  summary: {
    totalOrders: number;
    avgQuantityEfficiency: number;
    avgTimeEfficiency: number;
    onTimeOrders: number;
    onTimeRate: number;
  };
  orders: any[];
}

export interface QualityReport {
  period: { start: string; end: string };
  summary: {
    totalOrders: number;
    totalProduced: number;
    totalScrap: number;
    avgScrapRate: number;
    avgQualityRate: number;
  };
  orders: any[];
  byProduct: any[];
}

export interface WorkCenterReport {
  period: { start: string; end: string };
  workCenters: any[];
}

export interface ConsolidatedReport {
  period: { start: string; end: string };
  production: any;
  efficiency: any;
  quality: any;
  workCenters: number;
  generatedAt: string;
}

class ReportsService {
  private readonly basePath = '/reports';

  async getProductionReport(startDate: string, endDate: string): Promise<ProductionReport> {
    const response = await api.get(`${this.basePath}/production`, {
      params: { startDate, endDate },
    });
    return response.data.data;
  }

  async getEfficiencyReport(startDate: string, endDate: string): Promise<EfficiencyReport> {
    const response = await api.get(`${this.basePath}/efficiency`, {
      params: { startDate, endDate },
    });
    return response.data.data;
  }

  async getQualityReport(startDate: string, endDate: string): Promise<QualityReport> {
    const response = await api.get(`${this.basePath}/quality`, {
      params: { startDate, endDate },
    });
    return response.data.data;
  }

  async getWorkCenterReport(startDate: string, endDate: string): Promise<WorkCenterReport> {
    const response = await api.get(`${this.basePath}/work-centers`, {
      params: { startDate, endDate },
    });
    return response.data.data;
  }

  async getConsolidatedReport(startDate: string, endDate: string): Promise<ConsolidatedReport> {
    const response = await api.get(`${this.basePath}/consolidated`, {
      params: { startDate, endDate },
    });
    return response.data.data;
  }
}

export default new ReportsService();
