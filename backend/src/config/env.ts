import dotenv from 'dotenv';

dotenv.config();

/**
 * Valida e retorna uma variável de ambiente obrigatória
 * Se não estiver definida, encerra o processo com erro
 */
function requireEnv(key: string, errorMsg?: string): string {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    console.error(`❌ ERRO CRÍTICO: Variável de ambiente ${key} não definida!`);
    if (errorMsg) {
      console.error(`   ${errorMsg}`);
    }
    process.exit(1);
  }
  return value;
}

/**
 * Valida que uma variável de ambiente não está usando valor padrão inseguro
 */
function validateNotDefault(key: string, value: string, unsafeDefaults: string[]): string {
  if (unsafeDefaults.includes(value)) {
    console.error(`❌ ERRO CRÍTICO: ${key} está usando valor padrão inseguro!`);
    console.error(`   Por favor, defina um valor único e seguro para ${key}`);
    process.exit(1);
  }
  return value;
}

const jwtSecret = requireEnv(
  'JWT_SECRET',
  'Defina uma chave secreta forte para JWT (mínimo 32 caracteres)'
);

const jwtRefreshSecret = requireEnv(
  'JWT_REFRESH_SECRET',
  'Defina uma chave secreta forte para refresh token (mínimo 32 caracteres)'
);

const databaseUrl = requireEnv(
  'DATABASE_URL',
  'Defina a URL de conexão com o banco de dados'
);

// Validar que não estão usando valores padrão perigosos
validateNotDefault('JWT_SECRET', jwtSecret, [
  'default-secret',
  'secret',
  'your-secret-key',
  'your-super-secret-jwt-key-change-in-production',
  'fabric-jwt-secret-key'
]);

validateNotDefault('JWT_REFRESH_SECRET', jwtRefreshSecret, [
  'default-refresh-secret',
  'refresh-secret',
  'your-refresh-secret',
  'fabric-jwt-refresh-secret-key'
]);

// Validar tamanho mínimo das secrets (256 bits = 32 bytes = 32 caracteres)
if (jwtSecret.length < 32) {
  console.error('❌ ERRO CRÍTICO: JWT_SECRET deve ter pelo menos 32 caracteres!');
  console.error('   Use um gerador de senhas forte ou: openssl rand -base64 32');
  process.exit(1);
}

if (jwtRefreshSecret.length < 32) {
  console.error('❌ ERRO CRÍTICO: JWT_REFRESH_SECRET deve ter pelo menos 32 caracteres!');
  console.error('   Use um gerador de senhas forte ou: openssl rand -base64 32');
  process.exit(1);
}

export const config = {
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl,
  jwt: {
    secret: jwtSecret,
    refreshSecret: jwtRefreshSecret,
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  },
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  audit: {
    mode: process.env.AUDIT_LOG_MODE || 'write_only', // all, write_only, errors_only, none
    includeReads: process.env.AUDIT_LOG_INCLUDE_READS === 'true',
  },
};
