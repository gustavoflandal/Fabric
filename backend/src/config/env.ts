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

/**
 * SMTP — canal de email das notificações.
 *
 * DELIBERADAMENTE NÃO usa `requireEnv()`: email é um canal OPCIONAL. Uma
 * instalação que nunca configurou SMTP (todo ambiente de desenvolvimento e o
 * banco de teste, por exemplo) precisa continuar subindo normalmente — o
 * `email.service.ts` detecta a ausência de `SMTP_HOST`, loga um aviso uma única
 * vez e opera em modo no-op. Derrubar o boot por causa de um canal secundário
 * seria trocar "email não sai" por "sistema inteiro não sobe".
 *
 * `SMTP_USER`/`SMTP_PASSWORD` são opcionais mesmo com host configurado: relay
 * interno sem autenticação é um cenário real. Só passa `auth` ao transporte
 * quando os dois existem.
 */
const smtpHost = process.env.SMTP_HOST?.trim() || '';
const smtpPort = Number(process.env.SMTP_PORT) || 587;

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
    // Aceita uma lista separada por vírgula (dev usa 3 portas Vite diferentes).
    origin: (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:5174,http://localhost:5175')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  },
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  audit: {
    mode: process.env.AUDIT_LOG_MODE || 'write_only', // all, write_only, errors_only, none
    includeReads: process.env.AUDIT_LOG_INCLUDE_READS === 'true',
    // ✅ Fase 5 item 5.6 do cronograma: dias de retenção configuráveis via
    // env em vez de hardcoded em log-cleanup.job.ts (o job já existia e
    // já rodava diariamente - só não era ajustável sem editar código).
    retentionDays: Number(process.env.AUDIT_LOG_RETENTION_DAYS) || 90,
  },
  smtp: {
    host: smtpHost,
    port: smtpPort,
    // `SMTP_SECURE` true = TLS implícito desde a conexão (porta 465). Quando
    // não informado, deriva da porta — 465 é secure, 587/25 usam STARTTLS.
    secure: process.env.SMTP_SECURE
      ? process.env.SMTP_SECURE === 'true'
      : smtpPort === 465,
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
    from: process.env.SMTP_FROM || 'Fabric PCP <nao-responda@fabric.local>',
    /** Sem host não há como enviar: o serviço de email entra em modo no-op. */
    enabled: smtpHost !== '',
  },
};
