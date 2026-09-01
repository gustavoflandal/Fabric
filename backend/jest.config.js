// Fase 3 do cronograma (docs/fase-2026-09-modernizacao/02_CRONOGRAMA_IMPLEMENTACOES.md,
// item 3.1): fundação de testes automatizados. Antes, jest/ts-jest já estavam
// instalados e havia scripts npm para eles, mas não existia nenhum
// jest.config nem um único arquivo de teste em todo o backend.
//
// .js (não .ts) de propósito: Jest carrega o próprio arquivo de config via
// require() direto, e isso exigiria ts-node só para essa etapa (ts-jest
// cuida da transformação dos arquivos de TESTE, não do config).
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/*.test.ts', '**/*.spec.ts'],
  clearMocks: true,
  // Testes que batem no banco real (ver tests/helpers/db.ts) não podem rodar
  // em paralelo sem risco de interferir uns nos outros - roda em série por ora.
  maxWorkers: 1,
  testTimeout: 15000,
  setupFilesAfterEnv: ['<rootDir>/tests/jest.setup.ts'],
};
