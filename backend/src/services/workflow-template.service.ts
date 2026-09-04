import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { validateWorkflowGraph, GraphNodeInput, GraphEdgeInput } from './workflow-graph.service';
import { ConditionRule } from './workflow-condition.service';

interface NodeDto {
  clientId: string;
  type: GraphNodeInput['type'];
  label?: string | null;
  conditionRule?: ConditionRule | null;
  positionX: number;
  positionY: number;
}

interface EdgeDto {
  fromClientId: string;
  toClientId: string;
  branch?: 'SIM' | 'NAO' | null;
}

export interface WorkflowTemplateDto {
  name: string;
  description?: string | null;
  priority?: number;
  active?: boolean;
  triggerRule?: ConditionRule | null;
  entryClientId: string;
  nodes: NodeDto[];
  edges: EdgeDto[];
}

/**
 * Roda `validateWorkflowGraph` (Task 3) contra os CLIENT IDS do payload —
 * a função é agnóstica a se o id é temporário ou um uuid persistido (ver a
 * nota em workflow-graph.service.ts).
 */
function assertValidGraph(data: WorkflowTemplateDto): void {
  const graphNodes: GraphNodeInput[] = data.nodes.map((n) => ({
    id: n.clientId,
    type: n.type,
    conditionRule: n.conditionRule ?? null,
  }));
  const graphEdges: GraphEdgeInput[] = data.edges.map((e) => ({
    fromNodeId: e.fromClientId,
    toNodeId: e.toClientId,
    branch: e.branch ?? null,
  }));

  const errors = validateWorkflowGraph(graphNodes, graphEdges, data.entryClientId);
  if (errors.length > 0) {
    throw new AppError(400, errors.join(' '));
  }
}

const workflowTemplateService = {
  async list(active?: boolean) {
    return prisma.workflowTemplate.findMany({
      where: active === undefined ? {} : { active },
      orderBy: [{ priority: 'desc' }, { name: 'asc' }],
    });
  },

  async getById(id: string) {
    const template = await prisma.workflowTemplate.findUnique({
      where: { id },
      include: { nodes: true, edges: true },
    });
    if (!template) {
      throw new AppError(404, 'Template de workflow não encontrado');
    }
    return template;
  },

  async create(data: WorkflowTemplateDto) {
    assertValidGraph(data);

    return prisma.$transaction(async (tx) => {
      const template = await tx.workflowTemplate.create({
        data: {
          name: data.name,
          description: data.description ?? null,
          priority: data.priority ?? 0,
          active: data.active ?? true,
          triggerRule: (data.triggerRule ?? null) as object | null,
        },
      });

      const clientIdToNodeId = new Map<string, string>();
      for (const node of data.nodes) {
        const created = await tx.workflowNode.create({
          data: {
            templateId: template.id,
            type: node.type,
            label: node.label ?? null,
            conditionRule: (node.conditionRule ?? null) as object | null,
            positionX: node.positionX,
            positionY: node.positionY,
          },
        });
        clientIdToNodeId.set(node.clientId, created.id);
      }

      for (const edge of data.edges) {
        await tx.workflowEdge.create({
          data: {
            templateId: template.id,
            fromNodeId: clientIdToNodeId.get(edge.fromClientId)!,
            toNodeId: clientIdToNodeId.get(edge.toClientId)!,
            branch: edge.branch ?? null,
          },
        });
      }

      const entryNodeId = clientIdToNodeId.get(data.entryClientId);
      if (!entryNodeId) {
        throw new AppError(400, 'entryClientId não corresponde a nenhum nó enviado.');
      }

      return tx.workflowTemplate.update({
        where: { id: template.id },
        data: { entryNodeId },
        include: { nodes: true, edges: true },
      });
    });
  },

  /**
   * Substitui TODOS os nós/arestas do template pelo payload novo — o editor
   * visual sempre envia o grafo inteiro a cada "Salvar" (não há PATCH parcial
   * de nó/aresta individual). Delete-then-recreate dentro de uma transação:
   * mais simples e correto do que tentar diffar client ids contra uuids
   * antigos, e o grafo é pequeno (dezenas de nós, não milhares).
   */
  async update(id: string, data: WorkflowTemplateDto) {
    assertValidGraph(data);

    const existing = await prisma.workflowTemplate.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError(404, 'Template de workflow não encontrado');
    }

    return prisma.$transaction(async (tx) => {
      await tx.workflowTemplate.update({ where: { id }, data: { entryNodeId: null } });
      await tx.workflowEdge.deleteMany({ where: { templateId: id } });
      await tx.workflowNode.deleteMany({ where: { templateId: id } });

      const clientIdToNodeId = new Map<string, string>();
      for (const node of data.nodes) {
        const created = await tx.workflowNode.create({
          data: {
            templateId: id,
            type: node.type,
            label: node.label ?? null,
            conditionRule: (node.conditionRule ?? null) as object | null,
            positionX: node.positionX,
            positionY: node.positionY,
          },
        });
        clientIdToNodeId.set(node.clientId, created.id);
      }

      for (const edge of data.edges) {
        await tx.workflowEdge.create({
          data: {
            templateId: id,
            fromNodeId: clientIdToNodeId.get(edge.fromClientId)!,
            toNodeId: clientIdToNodeId.get(edge.toClientId)!,
            branch: edge.branch ?? null,
          },
        });
      }

      const entryNodeId = clientIdToNodeId.get(data.entryClientId);
      if (!entryNodeId) {
        throw new AppError(400, 'entryClientId não corresponde a nenhum nó enviado.');
      }

      return tx.workflowTemplate.update({
        where: { id },
        data: {
          name: data.name,
          description: data.description ?? null,
          priority: data.priority ?? 0,
          active: data.active ?? true,
          triggerRule: (data.triggerRule ?? null) as object | null,
          entryNodeId,
        },
        include: { nodes: true, edges: true },
      });
    });
  },

  async remove(id: string) {
    const existing = await prisma.workflowTemplate.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError(404, 'Template de workflow não encontrado');
    }
    // Cascade (schema.prisma) apaga nodes/edges junto.
    await prisma.workflowTemplate.delete({ where: { id } });
  },

  /** Cópia completa (nós, arestas, entrada) com novo nome e `active: false` — o admin revisa antes de ativar a cópia. */
  async duplicate(id: string) {
    const original = await prisma.workflowTemplate.findUnique({
      where: { id },
      include: { nodes: true, edges: true },
    });
    if (!original) {
      throw new AppError(404, 'Template de workflow não encontrado');
    }

    return prisma.$transaction(async (tx) => {
      const copy = await tx.workflowTemplate.create({
        data: {
          name: `${original.name} (cópia)`,
          description: original.description,
          priority: original.priority,
          active: false,
          triggerRule: original.triggerRule as object | null,
        },
      });

      const oldToNewNodeId = new Map<string, string>();
      for (const node of original.nodes) {
        const created = await tx.workflowNode.create({
          data: {
            templateId: copy.id,
            type: node.type,
            label: node.label,
            conditionRule: node.conditionRule as object | null,
            positionX: node.positionX,
            positionY: node.positionY,
          },
        });
        oldToNewNodeId.set(node.id, created.id);
      }

      for (const edge of original.edges) {
        await tx.workflowEdge.create({
          data: {
            templateId: copy.id,
            fromNodeId: oldToNewNodeId.get(edge.fromNodeId)!,
            toNodeId: oldToNewNodeId.get(edge.toNodeId)!,
            branch: edge.branch,
          },
        });
      }

      return tx.workflowTemplate.update({
        where: { id: copy.id },
        data: { entryNodeId: original.entryNodeId ? oldToNewNodeId.get(original.entryNodeId) : null },
        include: { nodes: true, edges: true },
      });
    });
  },
};

export default workflowTemplateService;
