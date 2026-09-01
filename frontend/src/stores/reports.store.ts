import { defineStore } from 'pinia';
import { ref } from 'vue';
import reportsService, {
  type ProductionReport,
  type EfficiencyReport,
  type QualityReport,
  type WorkCenterReport,
  type ConsolidatedReport,
} from '@/services/reports.service';

export const useReportsStore = defineStore('reports', () => {
  const productionReport = ref<ProductionReport | null>(null);
  const efficiencyReport = ref<EfficiencyReport | null>(null);
  const qualityReport = ref<QualityReport | null>(null);
  const workCenterReport = ref<WorkCenterReport | null>(null);
  const consolidatedReport = ref<ConsolidatedReport | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchProductionReport(startDate: string, endDate: string) {
    loading.value = true;
    error.value = null;
    try {
      productionReport.value = await reportsService.getProductionReport(startDate, endDate);
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao buscar relatório de produção';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function fetchEfficiencyReport(startDate: string, endDate: string) {
    loading.value = true;
    error.value = null;
    try {
      efficiencyReport.value = await reportsService.getEfficiencyReport(startDate, endDate);
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao buscar relatório de eficiência';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function fetchQualityReport(startDate: string, endDate: string) {
    loading.value = true;
    error.value = null;
    try {
      qualityReport.value = await reportsService.getQualityReport(startDate, endDate);
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao buscar relatório de qualidade';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function fetchWorkCenterReport(startDate: string, endDate: string) {
    loading.value = true;
    error.value = null;
    try {
      workCenterReport.value = await reportsService.getWorkCenterReport(startDate, endDate);
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao buscar relatório de centros';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function fetchConsolidatedReport(startDate: string, endDate: string) {
    loading.value = true;
    error.value = null;
    try {
      consolidatedReport.value = await reportsService.getConsolidatedReport(startDate, endDate);
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao buscar relatório consolidado';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  return {
    productionReport,
    efficiencyReport,
    qualityReport,
    workCenterReport,
    consolidatedReport,
    loading,
    error,
    fetchProductionReport,
    fetchEfficiencyReport,
    fetchQualityReport,
    fetchWorkCenterReport,
    fetchConsolidatedReport,
  };
});
