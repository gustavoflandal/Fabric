import bcrypt from 'bcryptjs';
import { testPrisma } from './db';

let unitCounter = 0;
let productCounter = 0;
let userCounter = 0;

export async function createTestUnit() {
  unitCounter += 1;
  return testPrisma.unitOfMeasure.create({
    data: { code: `UN-TEST-${unitCounter}`, name: 'Unidade de Teste', type: 'quantity', symbol: 'un' },
  });
}

export async function createTestProduct(overrides: Partial<{ minStock: number; safetyStock: number }> = {}) {
  productCounter += 1;
  const unit = await createTestUnit();
  return testPrisma.product.create({
    data: {
      code: `PROD-TEST-${productCounter}`,
      name: `Produto de Teste ${productCounter}`,
      type: 'raw_material',
      unitId: unit.id,
      minStock: overrides.minStock ?? 0,
      safetyStock: overrides.safetyStock ?? 0,
    },
  });
}

export async function createTestUser() {
  userCounter += 1;
  const password = await bcrypt.hash('Test@Password123', 4); // custo baixo - só testes
  return testPrisma.user.create({
    data: {
      email: `test-user-${userCounter}@fabric.local`,
      name: `Usuário Teste ${userCounter}`,
      password,
    },
  });
}

let planCounter = 0;
let sessionCounter = 0;

export async function createTestCountingPlan(
  creatorId: string,
  overrides: Partial<{ tolerancePercent: number; toleranceQty: number; requireRecount: boolean }> = {}
) {
  planCounter += 1;
  return testPrisma.countingPlan.create({
    data: {
      code: `PLAN-TEST-${planCounter}`,
      name: `Plano de Teste ${planCounter}`,
      type: 'CYCLIC',
      startDate: new Date(),
      createdBy: creatorId,
      tolerancePercent: overrides.tolerancePercent ?? 0,
      toleranceQty: overrides.toleranceQty ?? 0,
      requireRecount: overrides.requireRecount ?? true,
    },
  });
}

export async function createTestCountingSession(planId: string) {
  sessionCounter += 1;
  return testPrisma.countingSession.create({
    data: {
      code: `SESSION-TEST-${sessionCounter}`,
      planId,
      scheduledDate: new Date(),
      status: 'IN_PROGRESS',
    },
  });
}

export async function createTestCountingItem(sessionId: string, productId: string, systemQty: number) {
  return testPrisma.countingItem.create({
    data: {
      sessionId,
      productId,
      systemQty,
      status: 'PENDING',
    },
  });
}
