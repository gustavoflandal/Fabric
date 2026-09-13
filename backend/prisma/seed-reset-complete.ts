import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Limpando banco de dados (mantendo usuários)...\n');

  // Limpar dados em ordem de dependência (do mais dependente para o menos)
  console.log('  Removendo apontamentos...');
  await prisma.productionPointing.deleteMany({});

  console.log('  Removendo operações de ordens...');
  await prisma.productionOrderOperation.deleteMany({});

  console.log('  Removendo ordens de produção...');
  await prisma.productionOrder.deleteMany({});

  // YardVisit referencia PurchaseOrder (opcional) — precisa sair antes dele.
  console.log('  Removendo visitas e cadastros de pátio (YMS)...');
  await prisma.yardVisit.deleteMany({});
  await prisma.yardDock.deleteMany({});
  await prisma.yardSpot.deleteMany({});
  await prisma.yardArea.deleteMany({});
  await prisma.yardWarehouseParams.deleteMany({});
  await prisma.vehicle.deleteMany({});
  await prisma.driver.deleteMany({});
  await prisma.fleet.deleteMany({});

  // Equipment referencia WorkCenter — precisa sair antes dele (mais abaixo).
  console.log('  Removendo ordens e planos de manutenção...');
  await prisma.maintenanceOrder.deleteMany({});
  await prisma.maintenancePlan.deleteMany({});
  await prisma.equipment.deleteMany({});

  console.log('  Removendo compras...');
  await prisma.purchaseReceiptItem.deleteMany({});
  await prisma.purchaseReceipt.deleteMany({});
  await prisma.purchaseOrderItem.deleteMany({});
  await prisma.purchaseOrder.deleteMany({});
  await prisma.purchaseQuotationItem.deleteMany({});
  await prisma.purchaseQuotation.deleteMany({});

  // StockMovement referencia CountingSession (ajustes de contagem) — precisa
  // sair antes dele.
  console.log('  Removendo movimentações de estoque...');
  await prisma.stockMovement.deleteMany({});

  console.log('  Removendo contagens de inventário...');
  await prisma.countingItem.deleteMany({});
  await prisma.countingPlanProduct.deleteMany({});
  await prisma.countingSession.deleteMany({});
  await prisma.countingPlan.deleteMany({});

  // StockPositionBalance/Lot/StockBalance/StorageRule bloqueiam (RESTRICT) a
  // exclusão de StoragePosition e Product enquanto existirem — precisam sair
  // antes dos dois.
  console.log('  Removendo saldos por posição, lotes, saldo agregado e endereços do WMS...');
  await prisma.stockPositionBalance.deleteMany({});
  await prisma.lot.deleteMany({});
  await prisma.stockBalance.deleteMany({});
  await prisma.storageRule.deleteMany({});
  await prisma.storagePosition.deleteMany({});
  await prisma.warehouseStructure.deleteMany({});

  console.log('  Removendo roteiros e BOMs...');
  await prisma.routingOperation.deleteMany({});
  await prisma.routing.deleteMany({});
  await prisma.bOMItem.deleteMany({});
  await prisma.bOM.deleteMany({});
  
  console.log('  Removendo produtos e cadastros...');
  await prisma.product.deleteMany({});
  await prisma.productCategory.deleteMany({});
  await prisma.workCenter.deleteMany({});
  await prisma.supplier.deleteMany({});
  await prisma.customer.deleteMany({});
  await prisma.unitOfMeasure.deleteMany({});

  console.log('\n✅ Banco de dados limpo (usuários mantidos)\n');
  console.log('🌱 Execute os seguintes comandos, NESTA ORDEM, para popular o banco:\n');
  console.log('  npm run prisma:seed');
  console.log('  npm run prisma:seed-stock');
  console.log('  npm run prisma:seed-production');
  console.log('  npm run prisma:seed-pointings');
  console.log('  npm run prisma:seed-purchases');
  console.log('  npm run prisma:seed-counting');
  console.log('  npm run prisma:seed-counting-plans');
  console.log('  npm run prisma:seed-warehouses');
  console.log('  npm run prisma:seed-warehouse-structures');
  console.log('  npm run prisma:seed-maintenance');
  console.log('  npm run prisma:seed-yms');
  console.log('\n(ou simplesmente: npm run prisma:seed-all)\n');
}

main()
  .catch((e) => {
    console.error('❌ Erro ao limpar banco:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
