import { validateWorkflowGraph, GraphNodeInput, GraphEdgeInput } from '../../src/services/workflow-graph.service';

// Grafo válido de referência: Descarga -> Conferencia -> Decisao -> (SIM) Quarentena -> Alocacao
//                                                              -> (NAO) Alocacao
function validGraph(): { nodes: GraphNodeInput[]; edges: GraphEdgeInput[]; entryNodeId: string } {
  const nodes: GraphNodeInput[] = [
    { id: 'n1', type: 'DESCARGA', conditionRule: null },
    { id: 'n2', type: 'CONFERENCIA', conditionRule: null },
    { id: 'n3', type: 'DECISAO', conditionRule: { field: 'product.weight', operator: 'gt', value: 500 } },
    { id: 'n4', type: 'QUARENTENA', conditionRule: null },
    { id: 'n5', type: 'ALOCACAO', conditionRule: null },
  ];
  const edges: GraphEdgeInput[] = [
    { fromNodeId: 'n1', toNodeId: 'n2', branch: null },
    { fromNodeId: 'n2', toNodeId: 'n3', branch: null },
    { fromNodeId: 'n3', toNodeId: 'n4', branch: 'SIM' },
    { fromNodeId: 'n3', toNodeId: 'n5', branch: 'NAO' },
    { fromNodeId: 'n4', toNodeId: 'n5', branch: null },
  ];
  return { nodes, edges, entryNodeId: 'n1' };
}

describe('workflow-graph.service — validateWorkflowGraph', () => {
  it('aceita o grafo de referência sem erros', () => {
    const { nodes, edges, entryNodeId } = validGraph();
    expect(validateWorkflowGraph(nodes, edges, entryNodeId)).toEqual([]);
  });

  it('aceita o caso trivial: entrada já é Alocação, sem mais nada', () => {
    const nodes: GraphNodeInput[] = [{ id: 'n1', type: 'ALOCACAO', conditionRule: null }];
    expect(validateWorkflowGraph(nodes, [], 'n1')).toEqual([]);
  });

  it('rejeita entryNodeId que não existe no grafo', () => {
    const { nodes, edges } = validGraph();
    const errors = validateWorkflowGraph(nodes, edges, 'nao-existe');
    expect(errors).toContain('Nó de entrada não existe no fluxo.');
  });

  it('rejeita nó de entrada com conexão chegando nele', () => {
    const { nodes, edges, entryNodeId } = validGraph();
    edges.push({ fromNodeId: 'n5', toNodeId: 'n1', branch: null });
    const errors = validateWorkflowGraph(nodes, edges, entryNodeId);
    expect(errors).toContain('O nó de entrada não pode ter conexões chegando nele.');
  });

  it('rejeita nó DECISAO sem conditionRule', () => {
    const { nodes, edges, entryNodeId } = validGraph();
    nodes[2].conditionRule = null;
    const errors = validateWorkflowGraph(nodes, edges, entryNodeId);
    expect(errors.some((e) => e.includes('precisa de uma condição'))).toBe(true);
  });

  it('rejeita nó DECISAO com só uma saída', () => {
    const { nodes, edges, entryNodeId } = validGraph();
    const withoutNao = edges.filter((e) => !(e.fromNodeId === 'n3' && e.branch === 'NAO'));
    const errors = validateWorkflowGraph(nodes, withoutNao, entryNodeId);
    expect(errors.some((e) => e.includes('exatamente duas saídas'))).toBe(true);
  });

  it('rejeita nó DECISAO com duas saídas do mesmo branch (SIM duplicado)', () => {
    const { nodes, edges, entryNodeId } = validGraph();
    const withoutNao = edges.filter((e) => !(e.fromNodeId === 'n3' && e.branch === 'NAO'));
    withoutNao.push({ fromNodeId: 'n3', toNodeId: 'n5', branch: 'SIM' });
    const errors = validateWorkflowGraph(nodes, withoutNao, entryNodeId);
    expect(errors.some((e) => e.includes('exatamente duas saídas'))).toBe(true);
  });

  it('rejeita nó comum (não-DECISAO, não-ALOCACAO) com mais de uma saída', () => {
    const { nodes, edges, entryNodeId } = validGraph();
    edges.push({ fromNodeId: 'n1', toNodeId: 'n4', branch: null });
    const errors = validateWorkflowGraph(nodes, edges, entryNodeId);
    expect(errors.some((e) => e.includes('só pode ter uma saída'))).toBe(true);
  });

  it('rejeita ALOCACAO com saída', () => {
    const { nodes, edges, entryNodeId } = validGraph();
    edges.push({ fromNodeId: 'n5', toNodeId: 'n1', branch: null }); // também dispara o erro de entrada, ok
    const withoutBackToEntry = edges.filter((e) => e.fromNodeId !== 'n5' || e.toNodeId !== 'n1');
    withoutBackToEntry.push({ fromNodeId: 'n5', toNodeId: 'n4', branch: null });
    const errors = validateWorkflowGraph(nodes, withoutBackToEntry, entryNodeId);
    expect(errors.some((e) => e.includes('nó de Alocação não pode ter conexões saindo'))).toBe(true);
  });

  it('rejeita ciclo', () => {
    const { nodes, edges, entryNodeId } = validGraph();
    const withCycle = edges.filter((e) => !(e.fromNodeId === 'n4' && e.toNodeId === 'n5'));
    withCycle.push({ fromNodeId: 'n4', toNodeId: 'n2', branch: null }); // n2 -> n3 -> n4 -> n2
    const errors = validateWorkflowGraph(nodes, withCycle, entryNodeId);
    expect(errors.some((e) => e.includes('ciclo'))).toBe(true);
  });

  it('rejeita nó órfão (não alcançável a partir da entrada)', () => {
    const { nodes, edges, entryNodeId } = validGraph();
    nodes.push({ id: 'n6', type: 'SEGREGACAO', conditionRule: null });
    const errors = validateWorkflowGraph(nodes, edges, entryNodeId);
    expect(errors.some((e) => e.includes('não são alcançáveis'))).toBe(true);
  });

  it('rejeita caminho que termina num tipo diferente de ALOCACAO', () => {
    const nodes: GraphNodeInput[] = [
      { id: 'n1', type: 'DESCARGA', conditionRule: null },
      { id: 'n2', type: 'CONFERENCIA', conditionRule: null },
    ];
    const edges: GraphEdgeInput[] = [{ fromNodeId: 'n1', toNodeId: 'n2', branch: null }];
    const errors = validateWorkflowGraph(nodes, edges, 'n1');
    expect(errors.some((e) => e.includes('terminar em Alocação'))).toBe(true);
  });

  it('rejeita conexão apontando para nó inexistente', () => {
    const { nodes, edges, entryNodeId } = validGraph();
    edges.push({ fromNodeId: 'n5', toNodeId: 'nao-existe', branch: null });
    const withoutAlocSaida = edges.filter((e) => e.toNodeId !== 'nao-existe');
    withoutAlocSaida.push({ fromNodeId: 'n2', toNodeId: 'nao-existe', branch: null });
    const errors = validateWorkflowGraph(nodes, withoutAlocSaida, entryNodeId);
    expect(errors.some((e) => e.includes('nó inexistente'))).toBe(true);
  });
});
