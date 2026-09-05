import {
  pickTemplate,
  resolveWorkflowTasks,
  ResolvableTemplate,
} from '../../src/services/workflow-resolver.service';
import { ReceivingContext } from '../../src/services/workflow-condition.service';

const heavyContext: ReceivingContext = {
  order: { supplierId: 'sup-1' },
  items: [{ product: { weight: 800, volume: null, packagingType: null, segregationGroup: null, maxStackQty: null, lotTracked: false, categoryId: null } }],
};

const lightContext: ReceivingContext = {
  order: { supplierId: 'sup-1' },
  items: [{ product: { weight: 5, volume: null, packagingType: null, segregationGroup: null, maxStackQty: null, lotTracked: false, categoryId: null } }],
};

// Descarga -> Conferencia -> Decisao(peso>500) -[SIM]-> Quarentena -> Alocacao
//                                              -[NAO]-> Alocacao
function branchingTemplate(overrides: Partial<ResolvableTemplate> = {}): ResolvableTemplate {
  return {
    id: 'tpl-1',
    priority: 0,
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    triggerRule: null,
    entryNodeId: 'n1',
    nodes: [
      { id: 'n1', type: 'DESCARGA', conditionRule: null },
      { id: 'n2', type: 'CONFERENCIA', conditionRule: null },
      { id: 'n3', type: 'DECISAO', conditionRule: { field: 'product.weight', operator: 'gt', value: 500 } },
      { id: 'n4', type: 'QUARENTENA', conditionRule: null },
      { id: 'n5', type: 'ALOCACAO', conditionRule: null },
    ],
    edges: [
      { fromNodeId: 'n1', toNodeId: 'n2', branch: null },
      { fromNodeId: 'n2', toNodeId: 'n3', branch: null },
      { fromNodeId: 'n3', toNodeId: 'n4', branch: 'SIM' },
      { fromNodeId: 'n3', toNodeId: 'n5', branch: 'NAO' },
      { fromNodeId: 'n4', toNodeId: 'n5', branch: null },
    ],
    ...overrides,
  };
}

describe('workflow-resolver.service — resolveWorkflowTasks', () => {
  it('segue o ramo SIM quando a condição bate', () => {
    const steps = resolveWorkflowTasks(branchingTemplate(), heavyContext);
    expect(steps).toEqual(['DESCARGA', 'CONFERENCIA', 'QUARENTENA', 'ALOCACAO']);
  });

  it('segue o ramo NAO quando a condição não bate', () => {
    const steps = resolveWorkflowTasks(branchingTemplate(), lightContext);
    expect(steps).toEqual(['DESCARGA', 'CONFERENCIA', 'ALOCACAO']);
  });

  it('resolve um template de nó único (entrada = Alocação)', () => {
    const trivial: ResolvableTemplate = {
      id: 'tpl-2',
      priority: 0,
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      triggerRule: null,
      entryNodeId: 'only',
      nodes: [{ id: 'only', type: 'ALOCACAO', conditionRule: null }],
      edges: [],
    };
    expect(resolveWorkflowTasks(trivial, lightContext)).toEqual(['ALOCACAO']);
  });

  it('lança AppError se a entrada apontar para um nó que não existe', () => {
    const broken = branchingTemplate({ entryNodeId: 'nao-existe' });
    expect(() => resolveWorkflowTasks(broken, lightContext)).toThrow(/entrada inválida/);
  });

  it('lança AppError se um ciclo em runtime estourar o guard', () => {
    const cyclic = branchingTemplate({
      edges: [
        { fromNodeId: 'n1', toNodeId: 'n2', branch: null },
        { fromNodeId: 'n2', toNodeId: 'n1', branch: null }, // n1 <-> n2, nunca chega em Alocacao
      ],
    });
    expect(() => resolveWorkflowTasks(cyclic, lightContext)).toThrow(/ciclo/);
  });
});

describe('workflow-resolver.service — pickTemplate', () => {
  it('retorna null quando nenhum template tem triggerRule batendo', () => {
    const templates = [branchingTemplate({ triggerRule: { field: 'product.weight', operator: 'gt', value: 99999 } })];
    expect(pickTemplate(templates, heavyContext)).toBeNull();
  });

  it('retorna null quando o template não tem triggerRule (null nunca casa sozinho)', () => {
    const templates = [branchingTemplate({ triggerRule: null })];
    expect(pickTemplate(templates, heavyContext)).toBeNull();
  });

  it('retorna o template cujo triggerRule bate', () => {
    const templates = [branchingTemplate({ id: 'tpl-match', triggerRule: { field: 'product.weight', operator: 'gt', value: 100 } })];
    expect(pickTemplate(templates, heavyContext)?.id).toBe('tpl-match');
  });

  it('entre dois que batem, escolhe o de maior priority', () => {
    const low = branchingTemplate({ id: 'tpl-low', priority: 1, triggerRule: { field: 'product.weight', operator: 'gt', value: 0 } });
    const high = branchingTemplate({ id: 'tpl-high', priority: 5, triggerRule: { field: 'product.weight', operator: 'gt', value: 0 } });
    expect(pickTemplate([low, high], heavyContext)?.id).toBe('tpl-high');
  });

  it('em empate de priority, escolhe o mais recentemente atualizado — independente da ordem do array de entrada', () => {
    const older = branchingTemplate({
      id: 'tpl-older',
      priority: 3,
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      triggerRule: { field: 'product.weight', operator: 'gt', value: 0 },
    });
    const newer = branchingTemplate({
      id: 'tpl-newer',
      priority: 3,
      updatedAt: new Date('2026-06-01T00:00:00Z'),
      triggerRule: { field: 'product.weight', operator: 'gt', value: 0 },
    });
    expect(pickTemplate([older, newer], heavyContext)?.id).toBe('tpl-newer');
    expect(pickTemplate([newer, older], heavyContext)?.id).toBe('tpl-newer');
  });
});
