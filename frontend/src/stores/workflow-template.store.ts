import { defineStore } from 'pinia'
import { ref } from 'vue'
import workflowTemplateService from '@/services/workflow-template.service'
import type { WorkflowTemplate, WorkflowTemplateDto } from '@/types/workflow.types'

export const useWorkflowTemplateStore = defineStore('workflowTemplate', () => {
  const templates = ref<WorkflowTemplate[]>([])
  const loading = ref(false)

  const fetchTemplates = async (active?: boolean): Promise<WorkflowTemplate[]> => {
    loading.value = true
    try {
      const response = await workflowTemplateService.getAll(active)
      templates.value = response.data.data || []
      return templates.value
    } finally {
      loading.value = false
    }
  }

  const getTemplateById = async (id: string): Promise<WorkflowTemplate> => {
    const response = await workflowTemplateService.getById(id)
    return response.data.data
  }

  const createTemplate = async (data: WorkflowTemplateDto): Promise<WorkflowTemplate> => {
    const response = await workflowTemplateService.create(data)
    templates.value.push(response.data.data)
    return response.data.data
  }

  const updateTemplate = async (id: string, data: WorkflowTemplateDto): Promise<WorkflowTemplate> => {
    const response = await workflowTemplateService.update(id, data)
    const index = templates.value.findIndex((t) => t.id === id)
    if (index !== -1) templates.value[index] = response.data.data
    return response.data.data
  }

  const deleteTemplate = async (id: string): Promise<void> => {
    await workflowTemplateService.delete(id)
    templates.value = templates.value.filter((t) => t.id !== id)
  }

  const duplicateTemplate = async (id: string): Promise<WorkflowTemplate> => {
    const response = await workflowTemplateService.duplicate(id)
    templates.value.push(response.data.data)
    return response.data.data
  }

  return {
    templates,
    loading,
    fetchTemplates,
    getTemplateById,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    duplicateTemplate,
  }
})
