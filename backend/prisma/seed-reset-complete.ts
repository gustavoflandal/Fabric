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
  
  console.log('  Removendo compras...');
  await prisma.purchaseReceiptItem.deleteMany({});
  await prisma.purchaseReceipt.deleteMany({});
  await prisma.purchaseOrderItem.deleteMany({});
  await prisma.purchaseOrder.deleteMany({});
  await prisma.purchaseQuotationItem.deleteMany({});
  await prisma.purchaseQuotation.deleteMany({});
  
  console.log('  Removendo movimentações de estoque...');
  await prisma.stockMovement.deleteMany({});
  
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
  console.log('🌱 Execute os seguintes comandos para popular o banco:\n');
  console.log('  npm run prisma:seed');
  console.log('  npm run prisma:seed-stock');
  console.log('  npm run prisma:seed-production');
  console.log('  npm run prisma:seed-pointings\n');
}

main()
  .catch((e) => {
    console.error('❌ Erro ao limpar banco:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
