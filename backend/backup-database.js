// Script para fazer backup do banco de dados
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function backup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0];
  const backupDir = path.join(__dirname, '..', 'backups');
  const backupFile = path.join(backupDir, `fabric_backup_${timestamp}.json`);

  console.log('🗄️  Iniciando backup do banco de dados...\n');
  console.log(`📁 Arquivo: ${backupFile}\n`);

  try {
    const data = {
      timestamp: new Date().toISOString(),
      database: 'fabric',
      version: '1.0.0',
      tables: {}
    };

    // Exportar todas as tabelas principais
    console.log('📊 Exportando dados...\n');

    console.log('   ✓ Usuários');
    data.tables.users = await prisma.user.findMany();

    console.log('   ✓ Perfis');
    data.tables.roles = await prisma.role.findMany();

    console.log('   ✓ Permissões');
    data.tables.permissions = await prisma.permission.findMany();

    console.log('   ✓ Unidades de Medida');
    data.tables.unitOfMeasures = await prisma.unitOfMeasure.findMany();

    console.log('   ✓ Categorias de Produto');
    data.tables.productCategories = await prisma.productCategory.findMany();

    console.log('   ✓ Produtos');
    data.tables.products = await prisma.product.findMany();

    console.log('   ✓ BOMs');
    data.tables.boms = await prisma.bOM.findMany();

    console.log('   ✓ Itens de BOM');
    data.tables.bomItems = await prisma.bOMItem.findMany();

    console.log('   ✓ Roteiros');
    data.tables.routings = await prisma.routing.findMany();

    console.log('   ✓ Operações de Roteiro');
    data.tables.routingOperations = await prisma.routingOperation.findMany();

    console.log('   ✓ Centros de Trabalho');
    data.tables.workCenters = await prisma.workCenter.findMany();

    console.log('   ✓ Fornecedores');
    data.tables.suppliers = await prisma.supplier.findMany();

    console.log('   ✓ Clientes');
    data.tables.customers = await prisma.customer.findMany();

    console.log('   ✓ Ordens de Produção');
    data.tables.productionOrders = await prisma.productionOrder.findMany();

    console.log('   ✓ Operações de Ordem');
    data.tables.productionOrderOperations = await prisma.productionOrderOperation.findMany();

    console.log('   ✓ Apontamentos de Produção');
    data.tables.productionPointings = await prisma.productionPointing.findMany();

    console.log('   ✓ Movimentações de Estoque');
    data.tables.stockMovements = await prisma.stockMovement.findMany();

    console.log('   ✓ Logs de Auditoria');
    data.tables.auditLogs = await prisma.auditLog.findMany();

    // Salvar arquivo
    fs.writeFileSync(backupFile, JSON.stringify(data, null, 2));

    const stats = fs.statSync(backupFile);
    const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

    console.log('\n✅ Backup concluído com sucesso!');
    console.log(`📊 Tamanho: ${fileSizeInMB} MB`);
    console.log(`📁 Local: ${backupFile}\n`);

    // Estatísticas
    console.log('📈 Estatísticas:');
    Object.keys(data.tables).forEach(table => {
      console.log(`   - ${table}: ${data.tables[table].length} registros`);
    });

    // Listar backups existentes
    console.log('\n📋 Backups disponíveis:');
    const backups = fs.readdirSync(backupDir)
      .filter(file => file.startsWith('fabric_backup_'))
      .sort()
      .reverse()
      .slice(0, 5);

    backups.forEach((file, index) => {
      const filePath = path.join(backupDir, file);
      const stats = fs.statSync(filePath);
      const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
      const date = stats.mtime.toLocaleString('pt-BR');
      console.log(`   ${index + 1}. ${file}`);
      console.log(`      ${sizeInMB} MB - ${date}`);
    });

    console.log(`\n📊 Total: ${fs.readdirSync(backupDir).filter(f => f.startsWith('fabric_backup_')).length} backup(s)\n`);

  } catch (error) {
    console.error('❌ Erro ao fazer backup:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

backup();
