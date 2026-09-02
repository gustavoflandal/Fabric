import bcrypt from 'bcryptjs';
import { CountingPlanStatus, PositionType, Prisma } from '@prisma/client';
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

/**
 * F4.6/F4.10 (Fase 4b): os campos de armazenagem da F0.9 (`weight`,
 * `maxStackQty`, `segregationGroup`, dimensões) e `maxStock` entraram nos
 * overrides — são exatamente as entradas da regra de sugestão de endereço e da
 * regra de reposição. Continuam OPCIONAIS: todo teste anterior a esta fase
 * segue criando o mesmo produto sem nenhum dado físico, que é também o cenário
 * de quem acabou de licenciar o WMS.
 */
export async function createTestProduct(
  overrides: Partial<{
    minStock: number;
    safetyStock: number;
    maxStock: number;
    categoryId: string;
    weight: number;
    width: number;
    height: number;
    depth: number;
    maxStackQty: number;
    segregationGroup: string;
    /**
     * Fase 5: controle de lote OPT-IN. Default `false` — todo teste anterior a
     * esta fase segue criando exatamente o produto sem lote que sempre criou, e
     * nenhum deles passa a exigir `lotNumber` no recebimento.
     */
    lotTracked: boolean;
  }> = {}
) {
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
      maxStock: overrides.maxStock ?? null,
      categoryId: overrides.categoryId ?? null,
      weight: overrides.weight ?? null,
      width: overrides.width ?? null,
      height: overrides.height ?? null,
      depth: overrides.depth ?? null,
      maxStackQty: overrides.maxStackQty ?? null,
      segregationGroup: overrides.segregationGroup ?? null,
      lotTracked: overrides.lotTracked ?? false,
    },
  });
}

let lotCounter = 0;

/**
 * Fase 5: um `Lot` do produto, com validade opcional.
 *
 * `expiresAt` é passado como Date (e não como "dias a partir de hoje") de
 * propósito: o FEFO e o bloqueio de vencido comparam com `Date.now()`, e um
 * teste que diz `new Date('2020-01-01')` deixa explícito na leitura qual lote
 * está vencido — o que uma aritmética de dias esconderia.
 */
export async function createTestLot(
  productId: string,
  overrides: Partial<{
    lotNumber: string;
    manufacturedAt: Date | null;
    expiresAt: Date | null;
    supplierId: string | null;
  }> = {}
) {
  lotCounter += 1;
  return testPrisma.lot.create({
    data: {
      productId,
      lotNumber: overrides.lotNumber ?? `LOTE-TEST-${lotCounter}`,
      manufacturedAt: overrides.manufacturedAt ?? null,
      expiresAt: overrides.expiresAt ?? null,
      supplierId: overrides.supplierId ?? null,
    },
  });
}

let categoryCounter = 0;

/** F4.6: categoria de produto — o outro escopo possível de uma `StorageRule`. */
export async function createTestCategory() {
  categoryCounter += 1;
  return testPrisma.productCategory.create({
    data: { code: `CAT-TEST-${categoryCounter}`, name: `Categoria de Teste ${categoryCounter}` },
  });
}

let bomCounter = 0;

/**
 * F4.8: ordem de produção com BOM ativa — o gatilho de
 * `stock.service.ts::reserveForOrder()` nos dois modos (com e sem WMS).
 *
 * `scrapFactor` fica em 0 por padrão para que a quantidade necessária seja
 * exatamente `bomQty * orderQty`: um fator de refugo faria toda asserção de
 * quantidade dos testes carregar uma multiplicação que não é o que está sendo
 * verificado.
 */
export async function createTestProductionOrderWithBom(
  createdBy: string,
  components: { productId: string; quantity: number }[],
  orderQuantity = 1
) {
  bomCounter += 1;
  const finished = await createTestProduct();
  const unit = await createTestUnit();

  await testPrisma.bOM.create({
    data: {
      productId: finished.id,
      version: 1,
      active: true,
      items: {
        create: components.map((component, index) => ({
          componentId: component.productId,
          quantity: component.quantity,
          unitId: unit.id,
          scrapFactor: 0,
          sequence: index + 1,
        })),
      },
    },
  });

  const order = await testPrisma.productionOrder.create({
    data: {
      orderNumber: `OP-TEST-${bomCounter}`,
      productId: finished.id,
      quantity: orderQuantity,
      scheduledStart: new Date(),
      scheduledEnd: new Date(Date.now() + 86400000),
      createdBy,
    },
  });

  return { finished, order };
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
  quantity: number,
  /** Fase 5: a terceira dimensão. `null` = a linha sem lote de sempre. */
  lotId: string | null = null
) {
  return testPrisma.stockPositionBalance.create({
    data: { productId, storagePositionId, quantity, lotId },
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
export async function createTestPositions(
  count = 2,
  options: {
    floors?: number;
    streetCode?: string;
    /**
     * F4.10: marca as posições geradas como ÁREA DE PICKING. Default `false` —
     * o mesmo default da coluna, então toda fixture anterior a esta fase
     * continua gerando exatamente as posições de pulmão que sempre gerou e
     * nenhum teste antigo passa a disparar reposição.
     */
    isPickingArea?: boolean;
    /** F4.6: a regra de sugestão filtra candidatas por tipo de posição. */
    positionType?: PositionType;
    /** F4.6: capacidade de peso da posição (checagem de capacidade). */
    weightCapacity?: number;
  } = {}
) {
  warehouseCounter += 1;
  const warehouseCode = `WH${warehouseCounter}`;
  // F3.3: `floors` permite montar a rota serpentina (a direção de leitura das
  // posições alterna a cada andar). Default 1 — as fases anteriores criavam só
  // o andar 1 e os testes delas continuam vendo exatamente a mesma árvore.
  const floors = options.floors ?? 1;
  const streetCode = options.streetCode ?? 'R01';
  const positionType = options.positionType ?? 'PORTA_PALETES';
  const weightCapacity = options.weightCapacity ?? 1000;
  const isPickingArea = options.isPickingArea ?? false;

  const warehouse = await testPrisma.warehouse.create({
    data: { code: warehouseCode, name: `Armazém de Teste ${warehouseCounter}` },
  });

  const structure = await testPrisma.warehouseStructure.create({
    data: {
      warehouseId: warehouse.id,
      streetCode,
      floors,
      positions: count,
      positionType,
      weightCapacity,
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
            positionType,
            weightCapacity,
            height: 2,
            width: 1.2,
            depth: 1.1,
            maxHeight: 1.8,
            isPickingArea,
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

// ============================================
// Notificações: centros de trabalho, operações e apontamentos
// ============================================

let workCenterCounter = 0;

/**
 * Centro de trabalho. `capacity` é OPCIONAL de propósito: `detectLowCapacity()`
 * ignora centro sem capacidade cadastrada, e esse é justamente um dos casos que
 * precisa ser exercitado.
 */
export async function createTestWorkCenter(
  overrides: Partial<{ capacity: number | null; efficiency: number; active: boolean }> = {}
) {
  workCenterCounter += 1;
  return testPrisma.workCenter.create({
    data: {
      code: `WC-TEST-${workCenterCounter}`,
      name: `Centro de Teste ${workCenterCounter}`,
      type: 'MACHINE',
      capacity: overrides.capacity === undefined ? null : overrides.capacity,
      efficiency: overrides.efficiency ?? 1.0,
      active: overrides.active ?? true,
    },
  });
}

/** Usuário com o perfil `MANAGER` — o destinatário real de todos os detectores. */
export async function createTestManager() {
  const user = await createTestUser();
  const role = await testPrisma.role.upsert({
    where: { code: 'MANAGER' },
    update: {},
    create: { code: 'MANAGER', name: 'Gerente' },
  });
  await testPrisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  return user;
}

let opCounter = 0;

/** Ordem de produção mínima (sem BOM) — só para pendurar operações. */
export async function createTestProductionOrder(createdBy: string) {
  opCounter += 1;
  const product = await createTestProduct();
  return testPrisma.productionOrder.create({
    data: {
      orderNumber: `OP-WC-TEST-${opCounter}`,
      productId: product.id,
      quantity: 100,
      scheduledStart: new Date(),
      scheduledEnd: new Date(Date.now() + 86400000),
      createdBy,
    },
  });
}

/** Operação na fila de um centro — é o que caracteriza "há demanda". */
export async function createTestOperation(
  productionOrderId: string,
  workCenterId: string,
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' = 'PENDING'
) {
  return testPrisma.productionOrderOperation.create({
    data: {
      productionOrderId,
      workCenterId,
      sequence: 1,
      description: 'Operação de teste',
      plannedQty: 100,
      setupTime: 0,
      runTime: 1,
      totalPlannedTime: 1,
      status,
    },
  });
}

/**
 * Apontamento de produção concluído. `endTime` é o campo que
 * `detectLowCapacity()` usa para recortar a janela — por isso é parâmetro.
 */
export async function createTestPointing(params: {
  productionOrderId: string;
  operationId: string;
  workCenterId: string;
  userId: string;
  quantityGood: number;
  endTime?: Date;
}) {
  const endTime = params.endTime ?? new Date();
  return testPrisma.productionPointing.create({
    data: {
      productionOrderId: params.productionOrderId,
      operationId: params.operationId,
      workCenterId: params.workCenterId,
      userId: params.userId,
      quantityGood: params.quantityGood,
      quantityScrap: 0,
      runTime: 1,
      startTime: new Date(endTime.getTime() - 60 * 60 * 1000),
      endTime,
    },
  });
}
