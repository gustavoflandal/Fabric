import bcrypt from 'bcryptjs';
import { CountingPlanStatus, Prisma } from '@prisma/client';
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
      email: `test-user-${userCounter}@example.com`,
      name: `Usuário Teste ${userCounter}`,
      password,
    },
  });
}

let planCounter = 0;
let sessionCounter = 0;

export async function createTestCountingPlan(
  creatorId: string,
  overrides: Partial<{
    tolerancePercent: number;
    toleranceQty: number;
    requireRecount: boolean;
    // F3.2: `status` e `criteria` são necessários para exercitar
    // countingSessionService.create(), que exige plano ACTIVE e lê
    // `plan.criteria` sem guarda de null.
    status: CountingPlanStatus;
    criteria: Prisma.InputJsonValue;
  }> = {}
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
      status: overrides.status ?? 'DRAFT',
      criteria: overrides.criteria ?? {},
    },
  });
}

/**
 * F3.2: liga/desliga o módulo na instalação de teste. Quem chamar precisa
 * invalidar o cache em memória (`clearLicensedModuleCache()`) — ele é
 * proposital e sobrevive ao `cleanDatabase()`.
 */
export async function setTestLicensedModule(code: string, enabled: boolean) {
  return testPrisma.licensedModule.upsert({
    where: { code },
    update: { enabled },
    create: { code, enabled },
  });
}

/** F3.2: saldo endereçado (produto × posição), a fonte de `systemQty`. */
export async function createTestPositionBalance(
  productId: string,
  storagePositionId: string,
  quantity: number
) {
  return testPrisma.stockPositionBalance.create({
    data: { productId, storagePositionId, quantity },
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

let warehouseCounter = 0;

/**
 * F1.5 do plano do WMS: endereço pronto para pendurar saldo.
 *
 * Cria a árvore mínima `Warehouse -> WarehouseStructure -> StoragePosition` e
 * devolve as posições geradas. O `code` é montado com a mesma regra de
 * `buildPositionCode()` (F0.1) — aqui em linha, e não importando o service, para
 * que a fixture não dependa da implementação que alguns testes verificam.
 */
export async function createTestPositions(count = 2, options: { floors?: number; streetCode?: string } = {}) {
  warehouseCounter += 1;
  const warehouseCode = `WH${warehouseCounter}`;
  // F3.3: `floors` permite montar a rota serpentina (a direção de leitura das
  // posições alterna a cada andar). Default 1 — as fases anteriores criavam só
  // o andar 1 e os testes delas continuam vendo exatamente a mesma árvore.
  const floors = options.floors ?? 1;
  const streetCode = options.streetCode ?? 'R01';

  const warehouse = await testPrisma.warehouse.create({
    data: { code: warehouseCode, name: `Armazém de Teste ${warehouseCounter}` },
  });

  const structure = await testPrisma.warehouseStructure.create({
    data: {
      warehouseId: warehouse.id,
      streetCode,
      floors,
      positions: count,
      positionType: 'PORTA_PALETES',
      weightCapacity: 1000,
      height: 2,
      width: 1.2,
      depth: 1.1,
      maxHeight: 1.8,
    },
  });

  const positions = [];
  for (let floor = 1; floor <= floors; floor += 1) {
    for (let position = 1; position <= count; position += 1) {
      positions.push(
        await testPrisma.storagePosition.create({
          data: {
            structureId: structure.id,
            code: `${warehouseCode}-${streetCode}-${floor.toString().padStart(2, '0')}-${position.toString().padStart(2, '0')}`,
            warehouseCode,
            streetCode,
            floor,
            position,
            positionType: 'PORTA_PALETES',
            weightCapacity: 1000,
            height: 2,
            width: 1.2,
            depth: 1.1,
            maxHeight: 1.8,
          },
        })
      );
    }
  }

  return { warehouse, structure, positions };
}

let supplierCounter = 0;
let orderCounter = 0;

/**
 * F4.3 do plano do WMS: pedido de compra CONFIRMADO pronto para ser recebido —
 * o gatilho do recebimento nos dois modos (com e sem WMS licenciado).
 *
 * Cria fornecedor + pedido + itens e devolve tudo. `unitPrice` é explícito
 * porque `purchase-receipt.service.ts::updateProductCosts()` o usa para
 * recalcular o custo médio — deixá-lo em zero esconderia regressão nesse
 * cálculo.
 */
export async function createTestPurchaseOrder(
  createdBy: string,
  items: { productId: string; quantity: number; unitPrice?: number }[]
) {
  supplierCounter += 1;
  orderCounter += 1;

  const supplier = await testPrisma.supplier.create({
    data: { code: `SUP-TEST-${supplierCounter}`, name: `Fornecedor de Teste ${supplierCounter}` },
  });

  const totalValue = items.reduce(
    (sum, item) => sum + item.quantity * (item.unitPrice ?? 10),
    0
  );

  const order = await testPrisma.purchaseOrder.create({
    data: {
      orderNumber: `PO-TEST-${orderCounter}`,
      supplierId: supplier.id,
      expectedDate: new Date(),
      status: 'CONFIRMED',
      totalValue,
      createdBy,
      items: {
        create: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice ?? 10,
          totalPrice: item.quantity * (item.unitPrice ?? 10),
        })),
      },
    },
    include: { items: true },
  });

  return { supplier, order };
}

let roleCounter = 0;

/**
 * Cria um usuário (senha conhecida: 'Test@Password123') já com um perfil
 * contendo exatamente as permissões passadas. Usado pelos testes de
 * integração HTTP (tests/integration/) para autenticar com um usuário que
 * tem (ou não) a permissão certa, sem depender do perfil Administrador do
 * seed.
 */
export async function createUserWithPermissions(permissions: { resource: string; action: string }[]) {
  roleCounter += 1;
  const user = await createTestUser();

  const role = await testPrisma.role.create({
    data: { code: `ROLE-TEST-${roleCounter}`, name: `Perfil de Teste ${roleCounter}` },
  });

  for (const perm of permissions) {
    const permission = await testPrisma.permission.upsert({
      where: { resource_action: { resource: perm.resource, action: perm.action } },
      update: {},
      create: { resource: perm.resource, action: perm.action, description: 'teste' },
    });
    await testPrisma.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id } });
  }

  await testPrisma.userRole.create({ data: { userId: user.id, roleId: role.id } });

  return user;
}
