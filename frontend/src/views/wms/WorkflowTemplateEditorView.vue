<template>
  <AppLayout :title="isNew ? 'Novo Workflow' : 'Editar Workflow'" subtitle="Recebimento (WMS)">
    <template #actions>
      <button
        type="button"
        class="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-md hover:bg-primary-700"
        @click="handleSave"
      >
        Salvar
      </button>
    </template>

    <div v-if="clientErrors.length" class="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
      <p v-for="(error, index) in clientErrors" :key="index">{{ error }}</p>
    </div>

    <div class="grid grid-cols-4 gap-4 mb-4">
      <FormField label="Nome" required class="col-span-2">
        <input v-model="name" type="text" class="mock-input w-full rounded-md border-gray-300 text-sm" />
      </FormField>
      <FormField label="Prioridade">
        <input v-model.number="priority" type="number" min="0" class="w-full rounded-md border-gray-300 text-sm" />
      </FormField>
      <FormField label="Ativo">
        <input v-model="active" type="checkbox" class="mt-2" />
      </FormField>
    </div>

    <FormField label="Quando este workflow se aplica (condição de gatilho)" class="mb-4">
      <ConditionRuleBuilder v-model="triggerRule" />
    </FormField>

    <div class="flex gap-4" style="height: 520px">
      <div class="w-40 border border-gray-200 rounded-lg p-2 space-y-2 overflow-y-auto">
        <p class="label mb-1">Operações</p>
        <div
          v-for="type in PALETTE_TYPES"
          :key="type"
          class="text-xs border border-gray-300 rounded-md px-2 py-1 cursor-grab bg-gray-50"
          draggable="true"
          @dragstart="onDragStart($event, type)"
        >
          {{ WORKFLOW_NODE_LABELS[type] }}
        </div>
      </div>

      <div class="flex-1 border border-gray-200 rounded-lg" @drop="onDrop" @dragover.prevent>
        <VueFlow v-model:nodes="flowNodes" v-model:edges="flowEdges" @connect="onConnect" @node-click="onNodeClick">
          <template #node-entry="nodeProps">
            <EntryNode v-bind="nodeProps" />
          </template>
          <template #node-decision="nodeProps">
            <DecisionNode v-bind="nodeProps" :data="{ label: nodeProps.data.label }" />
          </template>
          <template #node-operation="nodeProps">
            <OperationNode v-bind="nodeProps" :data="{ type: nodeProps.data.workflowType }" />
          </template>
        </VueFlow>
      </div>

      <div v-if="selectedNode" class="w-64 border border-gray-200 rounded-lg p-3 overflow-y-auto">
        <p class="label mb-2">Nó selecionado: {{ selectedNodeLabel }}</p>
        <template v-if="selectedNode.type === 'decision'">
          <FormField label="Condição">
            <ConditionRuleBuilder v-model="selectedNode.data.conditionRule" />
          </FormField>
        </template>
        <button type="button" class="mt-3 text-xs text-red-600 hover:underline" @click="removeSelectedNode">
          Remover nó
        </button>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { VueFlow, useVueFlow, type Node, type Edge, type Connection, type NodeMouseEvent } from '@vue-flow/core'
import '@vue-flow/core/dist/style.css'
import AppLayout from '@/components/common/AppLayout.vue'
import FormField from '@/components/common/FormField.vue'
import ConditionRuleBuilder from '@/components/wms/ConditionRuleBuilder.vue'
import EntryNode from '@/components/wms/workflow-nodes/EntryNode.vue'
import DecisionNode from '@/components/wms/workflow-nodes/DecisionNode.vue'
import OperationNode from '@/components/wms/workflow-nodes/OperationNode.vue'
import { useWorkflowTemplateStore } from '@/stores/workflow-template.store'
import { WORKFLOW_NODE_LABELS } from '@/types/workflow.types'
import type { ConditionRule, WorkflowNodeType, WorkflowTemplateDto } from '@/types/workflow.types'
import { validateClientSide } from './workflow-editor-validation'

const PALETTE_TYPES: WorkflowNodeType[] = [
  'DESCARGA',
  'CONFERENCIA',
  'ETIQUETAGEM',
  'QUARENTENA',
  'SEGREGACAO',
  'AMOSTRAGEM',
  'ALOCACAO',
  'DECISAO',
]

// F-WORKFLOW — `workflowType` (não `type`) para não colidir com o `type` do
// VueFlow (que escolhe o template de renderização: 'entry' | 'decision' |
// 'operation'); é o mesmo nome de campo que a função de validação
// (workflow-editor-validation.ts) espera em `data.workflowType`. `label` e
// `conditionRule` são obrigatórios (nunca `undefined`) para casar com o
// `v-model` do ConditionRuleBuilder, que exige `ConditionRule | null` sem
// `undefined`.
interface FlowNodeData {
  workflowType: WorkflowNodeType
  label: string | null
  conditionRule: ConditionRule | null
}

const route = useRoute()
const router = useRouter()
const store = useWorkflowTemplateStore()
const { project, findNode } = useVueFlow()

const isNew = computed(() => route.params.id === undefined)
const clientErrors = ref<string[]>([])

const name = ref('')
const priority = ref(0)
const active = ref(true)
const triggerRule = ref<ConditionRule | null>(null)

// F-WORKFLOW — a Entrada é um nó fixo, sempre presente e nunca removível: é
// o único ponto sem handle de destino. `flowNodes` mistura o nó de entrada
// (type 'entry') com os nós de operação (type 'operation') e de decisão
// (type 'decision') — o `type` do VueFlow (que escolhe o template de
// renderização) é diferente do `WorkflowNodeType` do domínio, guardado em
// `data.workflowType`.
const flowNodes = ref<Node<FlowNodeData>[]>([
  { id: 'entry', type: 'entry', position: { x: 40, y: 200 }, data: { workflowType: 'DESCARGA', label: null, conditionRule: null } },
])
const flowEdges = ref<Edge[]>([])

onMounted(async () => {
  if (!isNew.value) {
    const template = await store.getTemplateById(route.params.id as string)
    name.value = template.name
    priority.value = template.priority
    active.value = template.active
    triggerRule.value = template.triggerRule

    flowNodes.value = template.nodes.map((n) => ({
      id: n.id,
      type: n.id === template.entryNodeId ? 'entry' : n.type === 'DECISAO' ? 'decision' : 'operation',
      position: { x: n.positionX, y: n.positionY },
      data: { workflowType: n.type, conditionRule: n.conditionRule, label: n.label },
    }))
    flowEdges.value = template.edges.map((e) => ({
      id: e.id,
      source: e.fromNodeId,
      target: e.toNodeId,
      sourceHandle: e.branch ?? undefined,
      type: 'smoothstep',
      label: e.branch ?? undefined,
    }))
  }
})

let nextNodeId = 1
function onDragStart(event: DragEvent, type: WorkflowNodeType): void {
  event.dataTransfer?.setData('application/workflow-node-type', type)
}

function onDrop(event: DragEvent): void {
  const type = event.dataTransfer?.getData('application/workflow-node-type') as WorkflowNodeType | undefined
  if (!type) return

  const position = project({ x: event.offsetX, y: event.offsetY })
  flowNodes.value.push({
    id: `node-${nextNodeId++}`,
    type: type === 'DECISAO' ? 'decision' : 'operation',
    position,
    data: { workflowType: type, label: null, conditionRule: null },
  })
}

function onConnect(connection: Connection): void {
  flowEdges.value.push({
    id: `edge-${connection.source}-${connection.target}-${connection.sourceHandle ?? ''}`,
    source: connection.source,
    target: connection.target,
    sourceHandle: connection.sourceHandle ?? undefined,
    type: 'smoothstep',
    label: connection.sourceHandle ?? undefined,
  })
}

const selectedNodeId = ref<string | null>(null)
const selectedNode = computed(() =>
  selectedNodeId.value ? findNode<FlowNodeData>(selectedNodeId.value) ?? null : null
)
const selectedNodeLabel = computed(() => {
  if (!selectedNode.value) return ''
  if (selectedNode.value.type === 'entry') return 'Entrada'
  return WORKFLOW_NODE_LABELS[selectedNode.value.data.workflowType]
})

function onNodeClick({ node }: NodeMouseEvent): void {
  selectedNodeId.value = node.id
}

function removeSelectedNode(): void {
  if (!selectedNodeId.value || selectedNodeId.value === 'entry') return
  flowNodes.value = flowNodes.value.filter((n) => n.id !== selectedNodeId.value)
  flowEdges.value = flowEdges.value.filter(
    (e) => e.source !== selectedNodeId.value && e.target !== selectedNodeId.value
  )
  selectedNodeId.value = null
}

async function handleSave(): Promise<void> {
  clientErrors.value = validateClientSide(flowNodes.value, flowEdges.value)
  if (clientErrors.value.length > 0) return

  const dto: WorkflowTemplateDto = {
    name: name.value,
    priority: priority.value,
    active: active.value,
    triggerRule: triggerRule.value,
    entryClientId: 'entry',
    // Non-null: todo item de `flowNodes` é criado (drop, carga inicial ou
    // node de entrada) sempre com `data` preenchido — ver comentário acima
    // de `FlowNodeData`. O tipo `Node.data` da lib é opcional porque cobre
    // casos de uso que não usamos aqui.
    nodes: flowNodes.value.map((n) => ({
      clientId: n.id,
      type: n.data!.workflowType,
      label: n.data!.label,
      conditionRule: n.data!.conditionRule,
      positionX: n.position.x,
      positionY: n.position.y,
    })),
    edges: flowEdges.value.map((e) => ({
      fromClientId: e.source,
      toClientId: e.target,
      branch: (e.sourceHandle as 'SIM' | 'NAO' | undefined) ?? null,
    })),
  }

  try {
    if (isNew.value) {
      await store.createTemplate(dto)
    } else {
      await store.updateTemplate(route.params.id as string, dto)
    }
    router.push('/wms/workflows')
  } catch (error: any) {
    clientErrors.value = [error?.response?.data?.message ?? 'Erro ao salvar o workflow.']
  }
}
</script>
