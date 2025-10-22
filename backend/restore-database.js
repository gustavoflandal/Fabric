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
    if (backupData.data) {
      Object.keys(backupData.data).forEach(table => {
        const count = Array.isArray(backupData.data[table]) ? backupData.data[table].length : 0;
        console.log(`   - ${table}: ${count} registros`);
      });
    }
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
    if (backupData.data.users?.length > 0) {
      for (const user of backupData.data.users) {
        const { roles, ...userData } = user;
        await prisma.user.create({ data: userData });
      }
      console.log(`   ✓ Usuários: ${backupData.data.users.length}`);
    }

    // Perfis
    if (backupData.data.roles?.length > 0) {
      for (const role of backupData.data.roles) {
        const { users, permissions, ...roleData } = role;
        await prisma.role.create({ data: roleData });
      }
      console.log(`   ✓ Perfis: ${backupData.data.roles.length}`);
    }

    // Permissões
    if (backupData.data.permissions?.length > 0) {
      for (const permission of backupData.data.permissions) {
        await prisma.permission.create({ data: permission });
      }
      console.log(`   ✓ Permissões: ${backupData.data.permissions.length}`);
    }

    // Unidades de Medida
    if (backupData.data.unitsOfMeasure?.length > 0) {
      for (const unit of backupData.data.unitsOfMeasure) {
        await prisma.unitOfMeasure.create({ data: unit });
      }
      console.log(`   ✓ Unidades de Medida: ${backupData.data.unitsOfMeasure.length}`);
    }

    // Categorias de Produto
    if (backupData.data.productCategories?.length > 0) {
      for (const category of backupData.data.productCategories) {
        await prisma.productCategory.create({ data: category });
      }
      console.log(`   ✓ Categorias: ${backupData.data.productCategories.length}`);
    }

    // Produtos
    if (backupData.data.products?.length > 0) {
      for (const product of backupData.data.products) {
        const { boms, routings, bomItems, routingOperations, productionOrders, stockMovements, ...productData } = product;
        await prisma.product.create({ data: productData });
      }
      console.log(`   ✓ Produtos: ${backupData.data.products.length}`);
    }

    // BOMs
    if (backupData.data.boms?.length > 0) {
      for (const bom of backupData.data.boms) {
        const { items, ...bomData } = bom;
        await prisma.bOM.create({ data: bomData });
      }
      console.log(`   ✓ BOMs: ${backupData.data.boms.length}`);
    }

    // Itens de BOM
    if (backupData.data.bomItems?.length > 0) {
      for (const item of backupData.data.bomItems) {
        await prisma.bOMItem.create({ data: item });
      }
      console.log(`   ✓ Itens de BOM: ${backupData.data.bomItems.length}`);
    }

    // Roteiros
    if (backupData.data.routings?.length > 0) {
      for (const routing of backupData.data.routings) {
        const { operations, ...routingData } = routing;
        await prisma.routing.create({ data: routingData });
      }
      console.log(`   ✓ Roteiros: ${backupData.data.routings.length}`);
    }

    // Operações de Roteiro
    if (backupData.data.routingOperations?.length > 0) {
      for (const operation of backupData.data.routingOperations) {
        await prisma.routingOperation.create({ data: operation });
      }
      console.log(`   ✓ Operações de Roteiro: ${backupData.data.routingOperations.length}`);
    }

    // Centros de Trabalho
    if (backupData.data.workCenters?.length > 0) {
      for (const workCenter of backupData.data.workCenters) {
        await prisma.workCenter.create({ data: workCenter });
      }
      console.log(`   ✓ Centros de Trabalho: ${backupData.data.workCenters.length}`);
    }

    // Fornecedores
    if (backupData.data.suppliers?.length > 0) {
      for (const supplier of backupData.data.suppliers) {
        await prisma.supplier.create({ data: supplier });
      }
      console.log(`   ✓ Fornecedores: ${backupData.data.suppliers.length}`);
    }

    // Clientes
    if (backupData.data.customers?.length > 0) {
      for (const customer of backupData.data.customers) {
        await prisma.customer.create({ data: customer });
      }
      console.log(`   ✓ Clientes: ${backupData.data.customers.length}`);
    }

    // Ordens de Produção
    if (backupData.data.productionOrders?.length > 0) {
      for (const order of backupData.data.productionOrders) {
        const { operations, pointings, ...orderData } = order;
        await prisma.productionOrder.create({ data: orderData });
      }
      console.log(`   ✓ Ordens de Produção: ${backupData.data.productionOrders.length}`);
    }

    // Operações de Ordem
    if (backupData.data.productionOrderOperations?.length > 0) {
      for (const operation of backupData.data.productionOrderOperations) {
        await prisma.productionOrderOperation.create({ data: operation });
      }
      console.log(`   ✓ Operações de Ordem: ${backupData.data.productionOrderOperations.length}`);
    }

    // Apontamentos
    if (backupData.data.productionPointings?.length > 0) {
      for (const pointing of backupData.data.productionPointings) {
        await prisma.productionPointing.create({ data: pointing });
      }
      console.log(`   ✓ Apontamentos: ${backupData.data.productionPointings.length}`);
    }

    // Movimentações de Estoque
    if (backupData.data.stockMovements?.length > 0) {
      for (const movement of backupData.data.stockMovements) {
        await prisma.stockMovement.create({ data: movement });
      }
      console.log(`   ✓ Movimentações de Estoque: ${backupData.data.stockMovements.length}`);
    }

    // Logs de Auditoria
    if (backupData.data.auditLogs?.length > 0) {
      for (const log of backupData.data.auditLogs) {
        await prisma.auditLog.create({ data: log });
      }
      console.log(`   ✓ Logs de Auditoria: ${backupData.data.auditLogs.length}`);
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
