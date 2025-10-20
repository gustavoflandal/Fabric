// Script para fazer backup do banco de dados MySQL
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configurações do banco (do .env)
const DB_HOST = 'localhost';
const DB_PORT = '3306';
const DB_USER = 'root';
const DB_PASSWORD = 'root';
const DB_NAME = 'fabric';

// Gerar nome do arquivo com timestamp
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + 
                  new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
const backupDir = path.join(__dirname, 'backups');
const backupFile = path.join(backupDir, `fabric_backup_${timestamp}.sql`);

console.log('🗄️  Iniciando backup do banco de dados...\n');
console.log(`📁 Arquivo: ${backupFile}\n`);

// Comando mysqldump
const command = `mysqldump -h ${DB_HOST} -P ${DB_PORT} -u ${DB_USER} -p${DB_PASSWORD} ${DB_NAME} > "${backupFile}"`;

exec(command, (error, stdout, stderr) => {
  if (error) {
    console.error('❌ Erro ao fazer backup:', error.message);
    
    // Tentar método alternativo usando node
    console.log('\n🔄 Tentando método alternativo...\n');
    alternativeBackup();
    return;
  }

  if (stderr && !stderr.includes('Warning')) {
    console.error('⚠️  Avisos:', stderr);
  }

  // Verificar se o arquivo foi criado
  if (fs.existsSync(backupFile)) {
    const stats = fs.statSync(backupFile);
    const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    console.log('✅ Backup concluído com sucesso!');
    console.log(`📊 Tamanho: ${fileSizeInMB} MB`);
    console.log(`📁 Local: ${backupFile}\n`);
    
    // Listar todos os backups
    listBackups();
  } else {
    console.error('❌ Arquivo de backup não foi criado');
  }
});

// Método alternativo usando Prisma
async function alternativeBackup() {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  
  try {
    console.log('📊 Exportando dados via Prisma...\n');
    
    const data = {
      timestamp: new Date().toISOString(),
      database: DB_NAME,
      tables: {}
    };
    
    // Exportar principais tabelas
    console.log('   - Exportando usuários...');
    data.tables.users = await prisma.user.findMany();
    
    console.log('   - Exportando produtos...');
    data.tables.products = await prisma.product.findMany();
    
    console.log('   - Exportando ordens de produção...');
    data.tables.productionOrders = await prisma.productionOrder.findMany();
    
    console.log('   - Exportando apontamentos...');
    data.tables.productionPointings = await prisma.productionPointing.findMany();
    
    console.log('   - Exportando movimentações de estoque...');
    data.tables.stockMovements = await prisma.stockMovement.findMany();
    
    // Salvar como JSON
    const jsonBackupFile = backupFile.replace('.sql', '.json');
    fs.writeFileSync(jsonBackupFile, JSON.stringify(data, null, 2));
    
    const stats = fs.statSync(jsonBackupFile);
    const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    console.log('\n✅ Backup JSON concluído!');
    console.log(`📊 Tamanho: ${fileSizeInMB} MB`);
    console.log(`📁 Local: ${jsonBackupFile}\n`);
    
    await prisma.$disconnect();
    listBackups();
    
  } catch (error) {
    console.error('❌ Erro no backup alternativo:', error.message);
    await prisma.$disconnect();
  }
}

function listBackups() {
  const backups = fs.readdirSync(backupDir)
    .filter(file => file.startsWith('fabric_backup_'))
    .sort()
    .reverse();
  
  if (backups.length > 0) {
    console.log('📋 Backups disponíveis:');
    backups.forEach((file, index) => {
      const filePath = path.join(backupDir, file);
      const stats = fs.statSync(filePath);
      const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
      const date = stats.mtime.toLocaleString('pt-BR');
      console.log(`   ${index + 1}. ${file} (${sizeInMB} MB) - ${date}`);
    });
    console.log(`\n📊 Total: ${backups.length} backup(s)\n`);
  }
}
