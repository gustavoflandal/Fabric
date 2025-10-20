import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function backupDatabase() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const backupDir = path.join(__dirname, '..', 'backup');
  const backupFile = path.join(backupDir, `fabric_backup_${timestamp}.json`);

  // Criar diretório de backup se não existir
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  console.log('📦 Iniciando backup do banco de dados...');

  try {
    const backup = {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      data: {
        // Usuários e Segurança
        users: await prisma.user.findMany({ include: { roles: true } }),
        roles: await prisma.role.findMany({ include: { permissions: true } }),
        permissions: await prisma.permission.findMany(),
        
        // Cadastros Básicos
        unitsOfMeasure: await prisma.unitOfMeasure.findMany(),
        productCategories: await prisma.productCategory.findMany(),
        suppliers: await prisma.supplier.findMany(),
        customers: await prisma.customer.findMany(),
        workCenters: await prisma.workCenter.findMany(),
        
        // Produtos
        products: await prisma.product.findMany(),
        boms: await prisma.bOM.findMany({ include: { items: true } }),
        routings: await prisma.routing.findMany({ include: { operations: true } }),
        
        // Produção
        productionOrders: await prisma.productionOrder.findMany({
          include: {
            operations: true,
            pointings: true,
          },
        }),
        
        // Compras
        purchaseQuotations: await prisma.purchaseQuotation.findMany({
          include: { items: true },
        }),
        purchaseOrders: await prisma.purchaseOrder.findMany({
          include: { items: true },
        }),
        purchaseReceipts: await prisma.purchaseReceipt.findMany({
          include: { items: true },
        }),
        
        // Estoque
        stockMovements: await prisma.stockMovement.findMany(),
        
        // Auditoria
        auditLogs: await prisma.auditLog.findMany({
          take: 1000, // Últimos 1000 registros
          orderBy: { createdAt: 'desc' },
        }),
      },
    };

    // Salvar backup
    fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));

    console.log('✅ Backup criado com sucesso!');
    console.log(`📁 Arquivo: ${backupFile}`);
    console.log(`📊 Estatísticas:`);
    console.log(`   - Usuários: ${backup.data.users.length}`);
    console.log(`   - Produtos: ${backup.data.products.length}`);
    console.log(`   - BOMs: ${backup.data.boms.length}`);
    console.log(`   - Ordens de Produção: ${backup.data.productionOrders.length}`);
    console.log(`   - Pedidos de Compra: ${backup.data.purchaseOrders.length}`);
    console.log(`   - Movimentações de Estoque: ${backup.data.stockMovements.length}`);
    console.log(`   - Logs de Auditoria: ${backup.data.auditLogs.length}`);

    const stats = fs.statSync(backupFile);
    const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`💾 Tamanho do arquivo: ${fileSizeInMB} MB`);

  } catch (error) {
    console.error('❌ Erro ao criar backup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

backupDatabase()
  .then(() => {
    console.log('🎉 Processo de backup concluído!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Falha no backup:', error);
    process.exit(1);
  });
