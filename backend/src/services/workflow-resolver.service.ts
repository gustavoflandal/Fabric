import { WorkflowNodeType } from '@prisma/client';
import { AppError } from '../middleware/error.middleware';
import { ConditionRule, ReceivingContext, evaluateRule } from './workflow-condition.service';

/**
 * F-WORKFLOW — o resolvedor de grafo. Substitui a montagem hardcoded de
 * `RECEIPT_TASK_CHAIN` (warehouse-task.service.ts) QUANDO existe um
 * WorkflowTemplate ativo cujo triggerRule bate com o recebimento — ver a
 * integração em warehouse-task.service.ts::createReceiptTaskChain (Task 5).
 *
 * `pickTemplate`/`resolveWorkflowTasks` recebem o grafo já carregado do banco
 * (formato simplificado, sem depender do client do Prisma diretamente) —
 * função pura, testável sem banco.
 */

export interface ResolvedTemplateNode {
  id: string;
  type: WorkflowNodeType;
  conditionRule: ConditionRule | null;
}

export interface ResolvedTemplateEdge {
  fromNodeId: string;
  toNodeId: string;
  branch: 'SIM' | 'NAO' | null;
}

export interface ResolvableTemplate {
  id: string;
  priority: number;
  // Desempate quando dois templates ativos têm a MESMA priority e ambos
  // batem com o mesmo recebimento (risco registrado no spec, resolvido
  // aqui): o mais RECENTEMENTE ATUALIZADO vence. Não depende da ordem em que
  // o chamador passou o array — `pickTemplate` é determinístico sozinho.
  updatedAt: Date;
  triggerRule: ConditionRule | null;
  entryNodeId: string;
  nodes: ResolvedTemplateNode[];
  edges: ResolvedTemplateEdge[];
}

/**
 * Maior priority, entre os templates cujo triggerRule bate, vence; empate de
 * priority é resolvido por `updatedAt` mais recente. `null` em `triggerRule`
 * nunca casa sozinho — só um template com condição EXPLÍCITA pode ser
 * selecionado (ver Global Constraints do plano/spec).
 */
export function pickTemplate(
  templates: ResolvableTemplate[],
  context: ReceivingContext
): ResolvableTemplate | null {
  const matching = templates
    .filter((t) => t.triggerRule !== null && evaluateRule(t.triggerRule, context))
    .sort((a, b) => b.priority - a.priority || b.updatedAt.getTime() - a.updatedAt.getTime());

  return matching[0] ?? null;
}

export function resolveWorkflowTasks(
  template: ResolvableTemplate,
  context: ReceivingContext
): WorkflowNodeType[] {
  const nodeById = new Map(template.nodes.map((n) => [n.id, n]));
  const outgoingByNode = new Map<string, ResolvedTemplateEdge[]>();
  for (const node of template.nodes) outgoingByNode.set(node.id, []);
  for (const edge of template.edges) {
    outgoingByNode.get(edge.fromNodeId)?.push(edge);
  }

  let current = nodeById.get(template.entryNodeId);
  if (!current) {
    throw new AppError(500, `Template de workflow "${template.id}" tem entrada inválida.`);
  }

  const steps: WorkflowNodeType[] = [];
  let guard = 0;

  while (true) {
    if (++guard > template.nodes.length + 1) {
      throw new AppError(500, `Template de workflow "${template.id}" tem um ciclo — recebimento bloqueado.`);
    }

    if (current.type === 'DECISAO') {
      if (!current.conditionRule) {
        throw new AppError(500, `Nó de decisão "${current.id}" do template "${template.id}" sem condição configurada.`);
      }
      const branch = evaluateRule(current.conditionRule, context) ? 'SIM' : 'NAO';
      const edge = outgoingByNode.get(current.id)?.find((e) => e.branch === branch);
      if (!edge) {
        throw new AppError(500, `Nó de decisão "${current.id}" do template "${template.id}" sem saída "${branch}".`);
      }
      const next = nodeById.get(edge.toNodeId);
      if (!next) {
        throw new AppError(500, `Template de workflow "${template.id}" tem uma conexão para um nó inexistente.`);
      }
      current = next;
      continue;
    }

    steps.push(current.type);
    if (current.type === 'ALOCACAO') {
      break;
    }

    const edge = outgoingByNode.get(current.id)?.[0];
    if (!edge) {
      throw new AppError(500, `Template de workflow "${template.id}" tem um caminho que não termina em Alocação.`);
    }
    const next = nodeById.get(edge.toNodeId);
    if (!next) {
      throw new AppError(500, `Template de workflow "${template.id}" tem uma conexão para um nó inexistente.`);
    }
    current = next;
  }

  return steps;
}
