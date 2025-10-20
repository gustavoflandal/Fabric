// Script utilizado apenas para ambientes de desenvolvimento sem cliente MySQL disponível.
// O banco foi criado manualmente a partir do arquivo `backend/manual-schema.sql`.
// Mantido aqui como referência para necessidades futuras.

const mysql = require('mysql2/promise');

async function createDatabase() {
  try {
    // Conectar sem especificar o banco
    const connection = await mysql.createConnection({
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: 'root'
    });

    console.log('✅ Conectado ao MySQL');

    // Criar banco de dados
    await connection.query(
      'CREATE DATABASE IF NOT EXISTS fabric CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
    );

    console.log('✅ Banco de dados "fabric" criado com sucesso!');

    await connection.end();
  } catch (error) {
    console.error('❌ Erro ao criar banco de dados:', error.message || error.code);
    console.error(error);
    process.exit(1);
  }
}

createDatabase();
