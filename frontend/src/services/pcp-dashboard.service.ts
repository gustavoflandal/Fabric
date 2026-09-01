import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

export interface PCPDashboardKPIs {
  ordersInProgress: number;
  ordersTotal: number;
  efficiency: number;
  efficiencyTrend: number;
  scrapRate: number;
  scrapQuantity: number;
  delayedOrders: number;
}

export interface OrdersByStatus {
  status: string;
  count: number;
}

export interface DailyProduction {
  date: string;
  produced: number;
  planned: number;
}

export interface WorkCenterEfficiency {
  workCenterName: string;
  efficiency: number;
}

export interface TopProduct {
  productName: string;
  quantity: number;
}

export interface WorkCenterOccupation {
  workCenterName: string;
  occupation: number;
}

export interface TimeDistribution {
  date: string;
  setupTime: number;
  runTime: number;
}

export interface PCPDashboardData {
  kpis: PCPDashboardKPIs;
  ordersByStatus: OrdersByStatus[];
  dailyProduction: DailyProduction[];
  workCenterEfficiency: WorkCenterEfficiency[];
  topProducts: TopProduct[];
  workCenterOccupation: WorkCenterOccupation[];
  timeDistribution: TimeDistribution[];
}

class PCPDashboardService {
  private getAuthHeaders() {
    const token = localStorage.getItem('accessToken');
    return {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };
  }

  async getDashboardData(): Promise<PCPDashboardData> {
    try {
      const response = await axios.get(`${API_URL}/pcp/dashboard`, this.getAuthHeaders());
      return response.data;
    } catch (error) {
      console.error('Error fetching PCP dashboard data:', error);
      throw error;
    }
  }

  async getKPIs(): Promise<PCPDashboardKPIs> {
    try {
      const response = await axios.get(`${API_URL}/pcp/dashboard/kpis`, this.getAuthHeaders());
      return response.data;
    } catch (error) {
      console.error('Error fetching KPIs:', error);
      throw error;
    }
  }

  async getOrdersByStatus(): Promise<OrdersByStatus[]> {
    try {
      const response = await axios.get(`${API_URL}/pcp/dashboard/orders-by-status`, this.getAuthHeaders());
      return response.data;
    } catch (error) {
      console.error('Error fetching orders by status:', error);
      throw error;
    }
  }

  async getDailyProduction(days: number = 7): Promise<DailyProduction[]> {
    try {
      const response = await axios.get(`${API_URL}/pcp/dashboard/daily-production?days=${days}`, this.getAuthHeaders());
      return response.data;
    } catch (error) {
      console.error('Error fetching daily production:', error);
      throw error;
    }
  }

  async getWorkCenterEfficiency(): Promise<WorkCenterEfficiency[]> {
    try {
      const response = await axios.get(`${API_URL}/pcp/dashboard/work-center-efficiency`, this.getAuthHeaders());
      return response.data;
    } catch (error) {
      console.error('Error fetching work center efficiency:', error);
      throw error;
    }
  }

  async getTopProducts(limit: number = 5): Promise<TopProduct[]> {
    try {
      const response = await axios.get(`${API_URL}/pcp/dashboard/top-products?limit=${limit}`, this.getAuthHeaders());
      return response.data;
    } catch (error) {
      console.error('Error fetching top products:', error);
      throw error;
    }
  }

  async getWorkCenterOccupation(): Promise<WorkCenterOccupation[]> {
    try {
      const response = await axios.get(`${API_URL}/pcp/dashboard/work-center-occupation`, this.getAuthHeaders());
      return response.data;
    } catch (error) {
      console.error('Error fetching work center occupation:', error);
      throw error;
    }
  }

  async getTimeDistribution(days: number = 7): Promise<TimeDistribution[]> {
    try {
      const response = await axios.get(`${API_URL}/pcp/dashboard/time-distribution?days=${days}`, this.getAuthHeaders());
      return response.data;
    } catch (error) {
      console.error('Error fetching time distribution:', error);
      throw error;
    }
  }
}

export default new PCPDashboardService();
