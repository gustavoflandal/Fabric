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
