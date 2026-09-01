import dotenv from 'dotenv';
import path from 'path';

// Carrega .env.test ANTES de qualquer módulo que leia process.env (config/env.ts,
// config/database.ts) ser importado pelos testes - por isso isso está em
// setupFilesAfterEnv do jest.config.ts, que roda antes de cada arquivo de teste.
dotenv.config({ path: path.resolve(__dirname, '../.env.test'), override: true });
