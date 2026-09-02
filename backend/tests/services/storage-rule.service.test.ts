import { cleanDatabase, disconnectTestDb, testPrisma } from '../helpers/db';
import {
  createTestCategory,
  createTestPositionBalance,
  createTestPositions,
  createTestProduct,
} from '../helpers/fixtures';
import {
  resolveQuarantineRequirement,
  suggestPosition,
} from '../../src/services/storage-rule.service';
import { prisma } from '../../src/config/database';

/**
 * F4.6 do plano do WMS — regra de armazenagem e sugestão de endereço.
 *
 * O que estes testes protegem, em ordem de importância:
 *   1. a PRECEDÊNCIA de regra (produto ganha de categoria, prioridade desempata
 *      dentro do mesmo escopo) — é a parte da regra que é fácil quebrar sem
 *      perceber, porque o banco não expressa hierarquia nenhuma;
 *   2. a SEGREGAÇÃO (grupo diferente e não-nulo bloqueia; mesmo grupo é
 *      preferido) — a definição de "incompatível" desta fase;
 *   3. a CAPACIDADE cruzando os dois lados (posição × produto);
 *   4. a resolução da QUARENTENA, que é o TODO da Fase 4a fechado por F4.6.
 */

const createRule = (data: {
  productId?: string;
  categoryId?: string;
  positionType?: any;
  priority?: number;
  requiresQuarantine?: boolean;
  active?: boolean;
}) =>
  testPrisma.storageRule.create({
    data: {
      productId: data.productId ?? null,
      categoryId: data.categoryId ?? null,
      positionType: data.positionType ?? null,
      priority: data.priority ?? 0,
      requiresQuarantine: data.requiresQuarantine ?? false,
      active: data.active ?? true,
    },
  });

describe('F4.6 — StorageRule e sugestão de endereço', () => {
  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  // ==========================================================================
  // Sem regra cadastrada
  // ==========================================================================
  it('sem nenhuma regra, sugere entre TODAS as posições não bloqueadas', async () => {
    const product = await createTestProduct();
    const { positions } = await createTestPositions(2);

    const result = await suggestPosition(product.id, 10);

    expect(result.appliedRuleId).toBeNull();
    expect(result.suggestion).not.toBeNull();
    expect(positions.map((p) => p.id)).toContain(result.suggestion!.positionId);
  });

  it('nunca sugere posição bloqueada', async () => {
    const product = await createTestProduct();
    const { positions } = await createTestPositions(2);

    await testPrisma.storagePosition.update({
      where: { id: positions[0].id },
      data: { blocked: true },
    });
    await testPrisma.storagePosition.update({
      where: { id: positions[1].id },
      data: { blocked: true },
    });

    const result = await suggestPosition(product.id, 10);

    expect(result.suggestion).toBeNull();
  });

  // ==========================================================================
  // Precedência de regra
  // ==========================================================================
  it('filtra as candidatas pelo positionType da regra', async () => {
    const product = await createTestProduct();
    await createTestPositions(1, { streetCode: 'R01', positionType: 'PORTA_PALETES' });
    const { positions: piso } = await createTestPositions(1, {
      streetCode: 'R02',
      positionType: 'PISO',
    });

    const rule = await createRule({ productId: product.id, positionType: 'PISO' });

    const result = await suggestPosition(product.id, 10);

    expect(result.appliedRuleId).toBe(rule.id);
    expect(result.suggestion!.positionId).toBe(piso[0].id);
    expect(result.suggestion!.positionType).toBe('PISO');
  });

  it('regra de PRODUTO ganha de regra de CATEGORIA, mesmo com prioridade menor', async () => {
    const category = await createTestCategory();
    const product = await createTestProduct({ categoryId: category.id });

    const { positions: piso } = await createTestPositions(1, {
      streetCode: 'R01',
      positionType: 'PISO',
    });
    await createTestPositions(1, { streetCode: 'R02', positionType: 'DOCA' });

    // A regra da categoria tem prioridade MUITO maior — e ainda assim perde.
    await createRule({ categoryId: category.id, positionType: 'DOCA', priority: 99 });
    const productRule = await createRule({
      productId: product.id,
      positionType: 'PISO',
      priority: 0,
    });

    const result = await suggestPosition(product.id, 10);

    expect(result.appliedRuleId).toBe(productRule.id);
    expect(result.suggestion!.positionId).toBe(piso[0].id);
  });

  it('dentro do mesmo escopo, a prioridade maior decide', async () => {
    const product = await createTestProduct();
    await createTestPositions(1, { streetCode: 'R01', positionType: 'PISO' });
    const { positions: doca } = await createTestPositions(1, {
      streetCode: 'R02',
      positionType: 'DOCA',
    });

    await createRule({ productId: product.id, positionType: 'PISO', priority: 1 });
    const winner = await createRule({
      productId: product.id,
      positionType: 'DOCA',
      priority: 10,
    });

    const result = await suggestPosition(product.id, 10);

    expect(result.appliedRuleId).toBe(winner.id);
    expect(result.suggestion!.positionId).toBe(doca[0].id);
  });

  it('regra inativa é ignorada', async () => {
    const product = await createTestProduct();
    // A ÚNICA posição da instalação é de porta-paletes. Se a regra inativa
    // fosse aplicada, ela filtraria por DOCA e não sobraria candidata nenhuma —
    // então uma sugestão não-nula é a prova de que a regra foi ignorada.
    const { positions: paletes } = await createTestPositions(1, {
      positionType: 'PORTA_PALETES',
    });

    await createRule({
      productId: product.id,
      positionType: 'DOCA',
      priority: 99,
      active: false,
    });

    const result = await suggestPosition(product.id, 10);

    expect(result.appliedRuleId).toBeNull();
    expect(result.suggestion!.positionId).toBe(paletes[0].id);
  });

  it('regra sem candidata viável cede a vez para a próxima regra', async () => {
    const product = await createTestProduct();
    const { positions: doca } = await createTestPositions(1, {
      streetCode: 'R02',
      positionType: 'DOCA',
    });

    // Regra de prioridade máxima aponta para um tipo de posição que a
    // instalação nem tem — não pode derrubar a sugestão inteira.
    await createRule({ productId: product.id, positionType: 'MEZANINO', priority: 99 });
    const fallback = await createRule({
      productId: product.id,
      positionType: 'DOCA',
      priority: 1,
    });

    const result = await suggestPosition(product.id, 10);

    expect(result.appliedRuleId).toBe(fallback.id);
    expect(result.suggestion!.positionId).toBe(doca[0].id);
  });

  // ==========================================================================
  // Segregação
  // ==========================================================================
  it('descarta posição ocupada por grupo de segregação DIFERENTE e não-nulo', async () => {
    const quimico = await createTestProduct({ segregationGroup: 'QUIMICO' });
    const alimento = await createTestProduct({ segregationGroup: 'ALIMENTO' });
    const { positions } = await createTestPositions(2);

    // A primeira posição (menor código) já tem material químico.
    await createTestPositionBalance(quimico.id, positions[0].id, 5);

    const result = await suggestPosition(alimento.id, 10);

    expect(result.suggestion!.positionId).toBe(positions[1].id);
    expect(result.rejected.map((r) => r.code)).toContain(positions[0].code);
    expect(result.rejected[0].reason).toMatch(/segregação incompatível/);
  });

  it('PREFERE posição já ocupada pelo MESMO grupo de segregação a uma vazia', async () => {
    const outro = await createTestProduct({ segregationGroup: 'ALIMENTO' });
    const alimento = await createTestProduct({ segregationGroup: 'ALIMENTO' });
    const { positions } = await createTestPositions(2);

    // Posição [1] (código maior, portanto perdedora do desempate) já tem o
    // mesmo grupo — a preferência tem de superar a ordem alfabética.
    await createTestPositionBalance(outro.id, positions[1].id, 5);

    const result = await suggestPosition(alimento.id, 10);

    expect(result.suggestion!.positionId).toBe(positions[1].id);
    expect(result.suggestion!.reasons.join(' ')).toMatch(/grupo de segregação ALIMENTO/);
  });

  it('produto SEM grupo entra em posição ocupada por produto também sem grupo', async () => {
    const neutro = await createTestProduct();
    const outro = await createTestProduct();
    const { positions } = await createTestPositions(1);

    await createTestPositionBalance(outro.id, positions[0].id, 5);

    const result = await suggestPosition(neutro.id, 10);

    expect(result.suggestion!.positionId).toBe(positions[0].id);
  });

  it('CONSOLIDAÇÃO vence tudo: posição que já tem o mesmo produto é a primeira', async () => {
    const product = await createTestProduct({ segregationGroup: 'ALIMENTO' });
    const mesmoGrupo = await createTestProduct({ segregationGroup: 'ALIMENTO' });
    const { positions } = await createTestPositions(3);

    await createTestPositionBalance(mesmoGrupo.id, positions[0].id, 5);
    await createTestPositionBalance(product.id, positions[2].id, 7);

    const result = await suggestPosition(product.id, 10);

    expect(result.suggestion!.positionId).toBe(positions[2].id);
    expect(result.suggestion!.currentQuantity).toBe('7');
    expect(result.suggestion!.reasons.join(' ')).toMatch(/consolidação/);
  });

  // ==========================================================================
  // Capacidade (posição × produto)
  // ==========================================================================
  it('descarta posição cuja capacidade de peso seria excedida', async () => {
    // 10 kg/unidade × 20 unidades = 200 kg; a posição só aguenta 100.
    const pesado = await createTestProduct({ weight: 10 });
    const { positions } = await createTestPositions(1, { weightCapacity: 100 });

    const result = await suggestPosition(pesado.id, 20);

    expect(result.suggestion).toBeNull();
    expect(result.rejected[0].reason).toMatch(/capacidade de peso excedida/);
  });

  it('conta o peso do que JÁ está na posição, não só o que vai entrar', async () => {
    const pesado = await createTestProduct({ weight: 10 });
    const { positions } = await createTestPositions(1, { weightCapacity: 100 });

    // 5 unidades = 50 kg já ocupam a posição; +6 (60 kg) estouraria os 100.
    await createTestPositionBalance(pesado.id, positions[0].id, 5);

    expect((await suggestPosition(pesado.id, 5)).suggestion).not.toBeNull();
    expect((await suggestPosition(pesado.id, 6)).suggestion).toBeNull();
  });

  it('descarta posição quando o empilhamento máximo do produto seria excedido', async () => {
    const empilhavel = await createTestProduct({ maxStackQty: 8 });
    const { positions } = await createTestPositions(1);

    await createTestPositionBalance(empilhavel.id, positions[0].id, 5);

    const result = await suggestPosition(empilhavel.id, 4);

    expect(result.suggestion).toBeNull();
    expect(result.rejected[0].reason).toMatch(/empilhamento máximo excedido/);
  });

  it('descarta posição em que a peça não cabe dimensionalmente', async () => {
    // A fixture cria posições de 1,2 m de largura.
    const largo = await createTestProduct({ width: 3 });
    const { positions } = await createTestPositions(1);

    const result = await suggestPosition(largo.id, 1);

    expect(result.suggestion).toBeNull();
    expect(result.rejected[0].reason).toMatch(/largura do produto/);
  });

  it('produto SEM dado físico não é reprovado por falta de cadastro', async () => {
    // Nenhum peso, dimensão ou empilhamento — o caso de quem acabou de
    // licenciar o WMS. A posição tem de continuar sendo sugerida.
    const semDados = await createTestProduct();
    const { positions } = await createTestPositions(1, { weightCapacity: 1 });

    const result = await suggestPosition(semDados.id, 999999);

    expect(result.suggestion!.positionId).toBe(positions[0].id);
  });

  // ==========================================================================
  // F4.6 — resolução da QUARENTENA (o TODO da Fase 4a)
  // ==========================================================================
  describe('resolveQuarantineRequirement', () => {
    it('SEM regra aplicável, exige quarentena (fallback seguro da Fase 4a)', async () => {
      const product = await createTestProduct();

      expect(await resolveQuarantineRequirement(prisma, [product.id])).toBe(true);
    });

    it('com regra do produto marcando requiresQuarantine=false, DISPENSA', async () => {
      const product = await createTestProduct();
      await createRule({ productId: product.id, requiresQuarantine: false });

      expect(await resolveQuarantineRequirement(prisma, [product.id])).toBe(false);
    });

    it('com regra do produto marcando requiresQuarantine=true, EXIGE', async () => {
      const product = await createTestProduct();
      await createRule({ productId: product.id, requiresQuarantine: true });

      expect(await resolveQuarantineRequirement(prisma, [product.id])).toBe(true);
    });

    it('regra de CATEGORIA vale para o produto que não tem regra própria', async () => {
      const category = await createTestCategory();
      const product = await createTestProduct({ categoryId: category.id });
      await createRule({ categoryId: category.id, requiresQuarantine: false });

      expect(await resolveQuarantineRequirement(prisma, [product.id])).toBe(false);
    });

    it('a regra do PRODUTO sobrepõe a da categoria', async () => {
      const category = await createTestCategory();
      const product = await createTestProduct({ categoryId: category.id });
      await createRule({ categoryId: category.id, requiresQuarantine: false, priority: 99 });
      await createRule({ productId: product.id, requiresQuarantine: true, priority: 0 });

      expect(await resolveQuarantineRequirement(prisma, [product.id])).toBe(true);
    });

    it('UM produto que exige quarentena quarentena o recebimento inteiro', async () => {
      const dispensado = await createTestProduct();
      const exigente = await createTestProduct();
      await createRule({ productId: dispensado.id, requiresQuarantine: false });
      await createRule({ productId: exigente.id, requiresQuarantine: true });

      expect(
        await resolveQuarantineRequirement(prisma, [dispensado.id, exigente.id])
      ).toBe(true);
    });

    it('todos os produtos dispensados => recebimento sem quarentena', async () => {
      const a = await createTestProduct();
      const b = await createTestProduct();
      await createRule({ productId: a.id, requiresQuarantine: false });
      await createRule({ productId: b.id, requiresQuarantine: false });

      expect(await resolveQuarantineRequirement(prisma, [a.id, b.id])).toBe(false);
    });
  });
});
