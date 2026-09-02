import countingItemService from '../../src/services/counting-item.service';
import { testPrisma, cleanDatabase, disconnectTestDb } from '../helpers/db';
import {
  createTestProduct,
  createTestUser,
  createTestCountingPlan,
  createTestCountingSession,
  createTestCountingItem,
} from '../helpers/fixtures';

// Fase 3 do cronograma, item 3.3: counting-item.service.ts::count()/recount()
// já foram "corrigidos" na auditoria original (ANALISE_FALHAS_SISTEMA.md)
// envolvendo a escrita em prisma.$transaction. Este teste verifica se isso
// realmente elimina a race condition, ou se - como aconteceu com
// registerMovement() na Fase 1 (que também tinha um comentário "✅
// CORREÇÃO" mas só cobria parte do problema) - a proteção é incompleta.

describe('counting-item.service (Fase 3, item 3.3)', () => {
  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  async function setup(overrides?: Parameters<typeof createTestCountingPlan>[1]) {
    const user = await createTestUser();
    const product = await createTestProduct();
    const plan = await createTestCountingPlan(user.id, overrides);
    const session = await createTestCountingSession(plan.id);
    const item = await createTestCountingItem(session.id, product.id, 100);
    return { user, product, plan, session, item };
  }

  it('count() dentro da tolerância marca o item como ADJUSTED', async () => {
    const { item, user } = await setup({ tolerancePercent: 5 });

    const result = await countingItemService.count(item.id, { countedQty: 101, countedBy: user.id });

    expect(result.status).toBe('ADJUSTED');
    expect(result.hasDifference).toBe(false);
  });

  it('count() fora da tolerância com requireRecount marca como COUNTED (aguardando recontagem)', async () => {
    const { item, user } = await setup({ tolerancePercent: 0, toleranceQty: 0, requireRecount: true });

    const result = await countingItemService.count(item.id, { countedQty: 150, countedBy: user.id });

    expect(result.status).toBe('COUNTED');
    expect(result.hasDifference).toBe(true);
  });

  it('count() rejeita contar um item que não está mais PENDING', async () => {
    const { item, user } = await setup();

    await countingItemService.count(item.id, { countedQty: 100, countedBy: user.id });

    await expect(
      countingItemService.count(item.id, { countedQty: 100, countedBy: user.id })
    ).rejects.toThrow(/já foi contado/i);
  });

  it('recount() atualiza os contadores da sessão dentro da mesma transação', async () => {
    const { item, session, user } = await setup({ tolerancePercent: 0, toleranceQty: 0 });

    await countingItemService.count(item.id, { countedQty: 150, countedBy: user.id });
    await countingItemService.recount(item.id, { recountQty: 100, recountedBy: user.id });

    const updatedSession = await testPrisma.countingSession.findUnique({ where: { id: session.id } });
    expect(updatedSession?.countedItems).toBe(1);
  });

  it(
    'CONCORRÊNCIA: dois count() simultâneos no MESMO item - só um pode vencer',
    async () => {
      const { item, user } = await setup();

      const results = await Promise.allSettled([
        countingItemService.count(item.id, { countedQty: 100, countedBy: user.id }),
        countingItemService.count(item.id, { countedQty: 200, countedBy: user.id }),
      ]);

      const succeeded = results.filter((r) => r.status === 'fulfilled');
      const failed = results.filter((r) => r.status === 'rejected');

      // Se isso falhar (as duas "tiverem sucesso"), é a mesma classe de bug
      // encontrada em registerMovement() na Fase 1: a transação protege a
      // ESCRITA, mas não a leitura de status feita antes dela (findById()
      // roda fora da transação, sem lock) - duas chamadas concorrentes podem
      // ambas ler status=PENDING e ambas conseguir escrever por cima uma da
      // outra, contando o mesmo item duas vezes.
      expect(succeeded).toHaveLength(1);
      expect(failed).toHaveLength(1);
    },
    20000
  );
});
