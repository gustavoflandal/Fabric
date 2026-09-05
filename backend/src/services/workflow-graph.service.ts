import { WorkflowNodeType } from '@prisma/client';
import { ConditionRule } from './workflow-condition.service';

/**
 * F-WORKFLOW — validação estrutural do grafo de um WorkflowTemplate. Roda no
 * BACKEND ao salvar (workflow-template.service.ts), não só na UI — o editor
 * visual roda a mesma checagem no cliente como feedback imediato, mas quem
 * decide o que persiste é sempre esta função (mesmo padrão de validação
 * dupla, cliente + servidor, já usado no resto do sistema).
 *
 * Aceita ids GENÉRICOS (string) de propósito: funciona tanto contra o grafo
 * já persistido (uuids reais) quanto contra o payload de criação, onde o
 * frontend ainda não tem uuid nenhum e usa ids temporários (clientId) — ver
 * workflow-template.service.ts.
 */

export interface GraphNodeInput {
  id: string;
  type: WorkflowNodeType;
  conditionRule: ConditionRule | null;
}

export interface GraphEdgeInput {
  fromNodeId: string;
  toNodeId: string;
  branch: 'SIM' | 'NAO' | null;
}

export function validateWorkflowGraph(
  nodes: GraphNodeInput[],
  edges: GraphEdgeInput[],
  entryNodeId: string
): string[] {
  const errors: string[] = [];
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  if (!nodeById.has(entryNodeId)) {
    errors.push('Nó de entrada não existe no fluxo.');
    return errors; // sem entrada válida, o resto da checagem não tem base
  }

  const incomingCount = new Map<string, number>();
  const outgoingByNode = new Map<string, GraphEdgeInput[]>();
  for (const node of nodes) outgoingByNode.set(node.id, []);

  for (const edge of edges) {
    if (!nodeById.has(edge.fromNodeId) || !nodeById.has(edge.toNodeId)) {
      errors.push('Existe uma conexão apontando para um nó inexistente.');
      continue;
    }
    incomingCount.set(edge.toNodeId, (incomingCount.get(edge.toNodeId) ?? 0) + 1);
    outgoingByNode.get(edge.fromNodeId)!.push(edge);
  }

  if ((incomingCount.get(entryNodeId) ?? 0) > 0) {
    errors.push('O nó de entrada não pode ter conexões chegando nele.');
  }

  for (const node of nodes) {
    const outgoing = outgoingByNode.get(node.id) ?? [];

    if (node.type === 'DECISAO') {
      if (!node.conditionRule) {
        errors.push(`Nó de decisão "${node.id}" precisa de uma condição configurada.`);
      }
      const branches = new Set(outgoing.map((e) => e.branch));
      if (outgoing.length !== 2 || !branches.has('SIM') || !branches.has('NAO')) {
        errors.push(`Nó de decisão "${node.id}" precisa de exatamente duas saídas (SIM e NAO).`);
      }
    } else if (node.type === 'ALOCACAO') {
      if (outgoing.length !== 0) {
        errors.push('O nó de Alocação não pode ter conexões saindo dele — é sempre o último passo.');
      }
    } else if (outgoing.length > 1) {
      errors.push(`Nó "${node.id}" (${node.type}) só pode ter uma saída.`);
    }
  }

  // Alcançabilidade + ciclo, via DFS a partir da entrada.
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const terminalTypesFound = new Set<WorkflowNodeType>();
  let hasCycle = false;

  function visit(nodeId: string): void {
    if (inStack.has(nodeId)) {
      hasCycle = true;
      return;
    }
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    inStack.add(nodeId);

    const node = nodeById.get(nodeId)!;
    const outgoing = (outgoingByNode.get(nodeId) ?? []).filter((e) => nodeById.has(e.toNodeId));
    if (outgoing.length === 0) {
      terminalTypesFound.add(node.type);
    }
    for (const edge of outgoing) {
      visit(edge.toNodeId);
    }
    inStack.delete(nodeId);
  }
  visit(entryNodeId);

  if (hasCycle) {
    errors.push('O fluxo tem um ciclo — uma sequência de conexões que volta a um nó já visitado.');
  }

  const orphanNodes = nodes.filter((n) => n.id !== entryNodeId && !visited.has(n.id));
  if (orphanNodes.length > 0) {
    errors.push('Existem nós no canvas que não são alcançáveis a partir da entrada.');
  }

  if (!hasCycle) {
    if (terminalTypesFound.size === 0) {
      errors.push('O fluxo não alcança nenhum nó terminal — verifique se há um caminho até Alocação.');
    } else if ([...terminalTypesFound].some((type) => type !== 'ALOCACAO')) {
      errors.push('Todo caminho do fluxo precisa terminar em Alocação.');
    }
  }

  return errors;
}
