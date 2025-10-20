// Script para restaurar backup do banco de dados
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function restore(backupFile) {
  console.log('🔄 Iniciando restauração do banco de dados...\n');

  try {
    // Verificar se o arquivo existe
    if (!fs.existsSync(backupFile)) {
      console.error('❌ Arquivo de backup não encontrado:', backupFile);
      console.log('\n📋 Backups disponíveis:');
      listBackups();
      process.exit(1);
    }

    // Ler arquivo de backup
    console.log(`📁 Lendo backup: ${path.basename(backupFile)}\n`);
    const backupData = JSON.parse(fs.readFileSync(backupFile, 'utf8'));

    console.log(`📅 Data do backup: ${new Date(backupData.timestamp).toLocaleString('pt-BR')}`);
    console.log(`📊 Versão: ${backupData.version}\n`);

    // Confirmar restauração
    console.log('⚠️  ATENÇÃO: Esta operação irá DELETAR todos os dados atuais!\n');
    console.log('📊 Dados que serão restaurados:');
    Object.keys(backupData.tables).forEach(table => {
      console.log(`   - ${table}: ${backupData.tables[table].length} registros`);
    });
    console.log('\n');

    // Aguardar 3 segundos para o usuário ler
    console.log('⏳ Iniciando em 3 segundos... (Ctrl+C para cancelar)\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Deletar dados existentes (na ordem correta para evitar erros de FK)
    console.log('🗑️  Deletando dados existentes...\n');

    await prisma.auditLog.deleteMany({});
    console.log('   ✓ Logs de Auditoria');

    await prisma.stockMovement.deleteMany({});
    console.log('   ✓ Movimentações de Estoque');

    await prisma.productionPointing.deleteMany({});
    console.log('   ✓ Apontamentos de Produção');

    await prisma.productionOrderOperation.deleteMany({});
    console.log('   ✓ Operações de Ordem');

    await prisma.productionOrder.deleteMany({});
    console.log('   ✓ Ordens de Produção');

    await prisma.routingOperation.deleteMany({});
    console.log('   ✓ Operações de Roteiro');

    await prisma.routing.deleteMany({});
    console.log('   ✓ Roteiros');

    await prisma.bOMItem.deleteMany({});
    console.log('   ✓ Itens de BOM');

    await prisma.bOM.deleteMany({});
    console.log('   ✓ BOMs');

    await prisma.product.deleteMany({});
    console.log('   ✓ Produtos');

    await prisma.productCategory.deleteMany({});
    console.log('   ✓ Categorias de Produto');

    await prisma.customer.deleteMany({});
    console.log('   ✓ Clientes');

    await prisma.supplier.deleteMany({});
    console.log('   ✓ Fornecedores');

    await prisma.workCenter.deleteMany({});
    console.log('   ✓ Centros de Trabalho');

    await prisma.unitOfMeasure.deleteMany({});
    console.log('   ✓ Unidades de Medida');

    await prisma.rolePermission.deleteMany({});
    await prisma.userRole.deleteMany({});
    await prisma.permission.deleteMany({});
    console.log('   ✓ Permissões');

    await prisma.role.deleteMany({});
    console.log('   ✓ Perfis');

    await prisma.user.deleteMany({});
    console.log('   ✓ Usuários');

    // Restaurar dados (na ordem correta)
    console.log('\n📥 Restaurando dados...\n');

    // Usuários
    if (backupData.tables.users?.length > 0) {
      for (const user of backupData.tables.users) {
        await prisma.user.create({ data: user });
      }
      console.log(`   ✓ Usuários: ${backupData.tables.users.length}`);
    }

    // Perfis
    if (backupData.tables.roles?.length > 0) {
      for (const role of backupData.tables.roles) {
        await prisma.role.create({ data: role });
      }
      console.log(`   ✓ Perfis: ${backupData.tables.roles.length}`);
    }

    // Permissões
    if (backupData.tables.permissions?.length > 0) {
      for (const permission of backupData.tables.permissions) {
        await prisma.permission.create({ data: permission });
      }
      console.log(`   ✓ Permissões: ${backupData.tables.permissions.length}`);
    }

    // Unidades de Medida
    if (backupData.tables.unitOfMeasures?.length > 0) {
      for (const unit of backupData.tables.unitOfMeasures) {
        await prisma.unitOfMeasure.create({ data: unit });
      }
      console.log(`   ✓ Unidades de Medida: ${backupData.tables.unitOfMeasures.length}`);
    }

    // Categorias de Produto
    if (backupData.tables.productCategories?.length > 0) {
      for (const category of backupData.tables.productCategories) {
        await prisma.productCategory.create({ data: category });
      }
      console.log(`   ✓ Categorias: ${backupData.tables.productCategories.length}`);
    }

    // Produtos
    if (backupData.tables.products?.length > 0) {
      for (const product of backupData.tables.products) {
        await prisma.product.create({ data: product });
      }
      console.log(`   ✓ Produtos: ${backupData.tables.products.length}`);
    }

    // BOMs
    if (backupData.tables.boms?.length > 0) {
      for (const bom of backupData.tables.boms) {
        await prisma.bOM.create({ data: bom });
      }
      console.log(`   ✓ BOMs: ${backupData.tables.boms.length}`);
    }

    // Itens de BOM
    if (backupData.tables.bomItems?.length > 0) {
      for (const item of backupData.tables.bomItems) {
        await prisma.bOMItem.create({ data: item });
      }
      console.log(`   ✓ Itens de BOM: ${backupData.tables.bomItems.length}`);
    }

    // Roteiros
    if (backupData.tables.routings?.length > 0) {
      for (const routing of backupData.tables.routings) {
        await prisma.routing.create({ data: routing });
      }
      console.log(`   ✓ Roteiros: ${backupData.tables.routings.length}`);
    }

    // Operações de Roteiro
    if (backupData.tables.routingOperations?.length > 0) {
      for (const operation of backupData.tables.routingOperations) {
        await prisma.routingOperation.create({ data: operation });
      }
      console.log(`   ✓ Operações de Roteiro: ${backupData.tables.routingOperations.length}`);
    }

    // Centros de Trabalho
    if (backupData.tables.workCenters?.length > 0) {
      for (const workCenter of backupData.tables.workCenters) {
        await prisma.workCenter.create({ data: workCenter });
      }
      console.log(`   ✓ Centros de Trabalho: ${backupData.tables.workCenters.length}`);
    }

    // Fornecedores
    if (backupData.tables.suppliers?.length > 0) {
      for (const supplier of backupData.tables.suppliers) {
        await prisma.supplier.create({ data: supplier });
      }
      console.log(`   ✓ Fornecedores: ${backupData.tables.suppliers.length}`);
    }

    // Clientes
    if (backupData.tables.customers?.length > 0) {
      for (const customer of backupData.tables.customers) {
        await prisma.customer.create({ data: customer });
      }
      console.log(`   ✓ Clientes: ${backupData.tables.customers.length}`);
    }

    // Ordens de Produção
    if (backupData.tables.productionOrders?.length > 0) {
      for (const order of backupData.tables.productionOrders) {
        await prisma.productionOrder.create({ data: order });
      }
      console.log(`   ✓ Ordens de Produção: ${backupData.tables.productionOrders.length}`);
    }

    // Operações de Ordem
    if (backupData.tables.productionOrderOperations?.length > 0) {
      for (const operation of backupData.tables.productionOrderOperations) {
        await prisma.productionOrderOperation.create({ data: operation });
      }
      console.log(`   ✓ Operações de Ordem: ${backupData.tables.productionOrderOperations.length}`);
    }

    // Apontamentos
    if (backupData.tables.productionPointings?.length > 0) {
      for (const pointing of backupData.tables.productionPointings) {
        await prisma.productionPointing.create({ data: pointing });
      }
      console.log(`   ✓ Apontamentos: ${backupData.tables.productionPointings.length}`);
    }

    // Movimentações de Estoque
    if (backupData.tables.stockMovements?.length > 0) {
      for (const movement of backupData.tables.stockMovements) {
        await prisma.stockMovement.create({ data: movement });
      }
      console.log(`   ✓ Movimentações de Estoque: ${backupData.tables.stockMovements.length}`);
    }

    // Logs de Auditoria
    if (backupData.tables.auditLogs?.length > 0) {
      for (const log of backupData.tables.auditLogs) {
        await prisma.auditLog.create({ data: log });
      }
      console.log(`   ✓ Logs de Auditoria: ${backupData.tables.auditLogs.length}`);
    }

    console.log('\n✅ Restauração concluída com sucesso!\n');
    console.log('🎉 Banco de dados restaurado para o estado do backup.\n');

  } catch (error) {
    console.error('\n❌ Erro ao restaurar backup:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

function listBackups() {
  const backupDir = path.join(__dirname, '..', 'backups');
  const backups = fs.readdirSync(backupDir)
    .filter(file => file.endsWith('.json'))
    .sort()
    .reverse();

  backups.forEach((file, index) => {
    const filePath = path.join(backupDir, file);
    const stats = fs.statSync(filePath);
    const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    const date = stats.mtime.toLocaleString('pt-BR');
    console.log(`   ${index + 1}. ${file}`);
    console.log(`      ${sizeInMB} MB - ${date}`);
  });
}

// Verificar argumentos
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('📋 Uso: node restore-database.js <arquivo-backup>\n');
  console.log('Exemplo: node restore-database.js ../backups/fabric_backup_2025-10-20T18-07-02-463Z.json\n');
  console.log('📋 Backups disponíveis:\n');
  listBackups();
  process.exit(0);
}

const backupFile = path.resolve(args[0]);
restore(backupFile);
