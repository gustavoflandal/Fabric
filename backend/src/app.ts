import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { logger } from './config/logger';
import { auditMiddleware } from './middleware/audit.middleware';
import routes from './routes';

const app = express();

// Middlewares
app.use(helmet());
app.use(cors({ 
  origin: ['http://localhost:5173', 'http://localhost:5175', 'http://localhost:5174'],
  credentials: true 
}));
app.use(express.json());
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
