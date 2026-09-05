import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { logger } from './config/logger';
import { auditMiddleware } from './middleware/audit.middleware';
import { generalLimiter } from './middleware/rate-limit.middleware';
import routes from './routes';

const app = express();

// Security middlewares
app.use(helmet());
app.use(cors({
  // ✅ Fase 2 item 2.6 do cronograma: origin estava fixo no código (3 portas
  // localhost hardcoded), ignorando CORS_ORIGIN - quebraria em qualquer
  // deploy real. Configurável via env agora (config/env.ts já parseia lista
  // separada por vírgula).
  origin: config.cors.origin,
  credentials: true
}));

// Rate limiting (aplicar antes de parsear body)
app.use(generalLimiter);

// Body parsing
// Limite default do Express (100kb) é pequeno demais para um XML de NFe com
// muitos itens (POST /purchase-receipts/parse-nfe, Fase de Recebimento).
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Audit logging middleware
app.use(auditMiddleware);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/v1', routes);

// Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

export { app };
