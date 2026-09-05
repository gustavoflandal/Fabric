import api from '@/services/api'
import type { ApiEnvelope } from '@/types/warehouse.types'
import type { WorkflowTemplate, WorkflowTemplateDto } from '@/types/workflow.types'

const workflowTemplateService = {
  async getAll(active?: boolean) {
    const params = new URLSearchParams()
    if (active !== undefined) params.append('active', String(active))
    return await api.get<ApiEnvelope<WorkflowTemplate[]>>(
      `/wms-workflow-templates?${params.toString()}`
    )
  },

  async getById(id: string) {
    return await api.get<ApiEnvelope<WorkflowTemplate>>(`/wms-workflow-templates/${id}`)
  },

  async create(data: WorkflowTemplateDto) {
    return await api.post<ApiEnvelope<WorkflowTemplate>>('/wms-workflow-templates', data)
  },

  async update(id: string, data: WorkflowTemplateDto) {
    return await api.put<ApiEnvelope<WorkflowTemplate>>(`/wms-workflow-templates/${id}`, data)
  },

  async delete(id: string) {
    return await api.delete<ApiEnvelope<null>>(`/wms-workflow-templates/${id}`)
  },

  async duplicate(id: string) {
    return await api.post<ApiEnvelope<WorkflowTemplate>>(`/wms-workflow-templates/${id}/duplicate`)
  },
}

export default workflowTemplateService
