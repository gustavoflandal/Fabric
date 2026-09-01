# Análise de Falhas do Sistema Fabric MES

**Data da Análise:** 22 de outubro de 2025  
**Versão do Sistema:** 1.0.0  
**Objetivo:** Identificar falhas críticas, médias e baixas que podem interferir no funcionamento ou causar má experiência ao usuário

---

## 📊 Sumário Executivo

Foram identificadas **32 falhas** distribuídas em:
- 🔴 **8 Críticas** - Requerem ação imediata
- 🟠 **15 Médias** - Devem ser corrigidas em breve
- 🟡 **9 Baixas** - Melhorias recomendadas

---

## 🔴 FALHAS CRÍTICAS (Prioridade Alta)

### 1. **Race Condition em Contagem de Estoque**
**Arquivo:** `backend/src/services/counting-item.service.ts`  
**Severidade:** 🔴 Crítica  
**Impacto:** Dados inconsistentes, perda de contagens

**Problema:**
```typescript
// Linha ~140-180: Método count() e recount()
async count(id: string, data: CountItemDTO): Promise<CountingItem> {
  const item = await this.findById(id);
  // ... processamento ...
  const updatedItem = await prisma.countingItem.update({ ... });
  await this.updateSessionCounters(item.sessionId); // ⚠️ Não está em transação
}
```

**Cenário de Falha:**
- Dois usuários contam o mesmo item simultaneamente
- Contador da sessão pode ser atualizado incorretamente
- Estatísticas de acuracidade podem ficar erradas

**Solução:**
```typescript
async count(id: string, data: CountItemDTO): Promise<CountingItem> {
  return await prisma.$transaction(async (tx) => {
    const item = await tx.countingItem.findUnique({
      where: { id },
      include: { session: { include: { plan: true } } }
    });
    
    if (!item || item.status !== 'PENDING') {
      throw new Error('Item já foi contado ou não encontrado');
    }
    
    // ... cálculos ...
    
    const updatedItem = await tx.countingItem.update({ 
      where: { id },
      data: { /* ... */ }
    });
    
    // Atualizar contadores dentro da transação
    const items = await tx.countingItem.findMany({ 
      where: { sessionId: item.sessionId } 
    });
    
    await tx.countingSession.update({
      where: { id: item.sessionId },
      data: {
        countedItems: items.filter(i => i.status !== 'PENDING').length,
        itemsWithDiff: items.filter(i => i.hasDifference).length
      }
    });
    
    return updatedItem;
  });
}
```

---

### 2. **Race Condition em Reserva de Estoque**
**Arquivo:** `backend/src/services/stock.service.ts`  
**Severidade:** 🔴 Crítica  
**Impacto:** Estoque negativo, reservas duplicadas

**Problema:**
```typescript
// Linha ~429-476: Método reserveForOrder()
async reserveForOrder(orderId: string, userId: string) {
  // ... busca BOM ...
  
  for (const bomItem of activeBom.items) {
    const balance = await this.getBalance(bomItem.componentId); // ⚠️ Read sem lock
    
    if (balance.quantity < requiredQty) {
      throw new Error(`Estoque insuficiente`);
    }
    
    const movement = await this.registerExit({ ... }); // ⚠️ Não atômico
  }
}
```

**Cenário de Falha:**
- Duas ordens tentam reservar o último item em estoque simultaneamente
- Ambas leem que há estoque suficiente
- Ambas registram saída, resultando em estoque negativo

**Solução:**
```typescript
async reserveForOrder(orderId: string, userId: string) {
  return await prisma.$transaction(async (tx) => {
    const order = await tx.productionOrder.findUnique({
      where: { id: orderId },
      include: { product: true }
    });
    
    if (!order) throw new Error('Ordem não encontrada');
    
    const activeBom = await tx.bOM.findFirst({
      where: { productId: order.productId, active: true },
      include: { items: { include: { component: true } } }
    });
    
    if (!activeBom) throw new Error('BOM não encontrada');
    
    const reservations = [];
    
    // Verificar TODOS os itens primeiro (fail-fast)
    for (const bomItem of activeBom.items) {
      const balance = await this.getBalanceInTransaction(tx, bomItem.componentId);
      const requiredQty = bomItem.quantity * order.quantity * (1 + bomItem.scrapFactor);
      
      if (balance.quantity < requiredQty) {
        throw new Error(`Estoque insuficiente para ${bomItem.component.code}`);
      }
    }
    
    // Se passou, registrar TODAS as saídas
    for (const bomItem of activeBom.items) {
      const requiredQty = bomItem.quantity * order.quantity * (1 + bomItem.scrapFactor);
      
      const movement = await tx.stockMovement.create({
        data: {
          productId: bomItem.componentId,
          type: 'OUT',
          quantity: requiredQty,
          reason: 'Reserva para produção',
          reference: order.orderNumber,
          referenceType: 'PRODUCTION',
          userId
        }
      });
      
      reservations.push(movement);
    }
    
    return { orderId, orderNumber: order.orderNumber, reservations };
  });
}
```

---

### 3. **Falta de Validação de Integridade em Datas**
**Arquivo:** `backend/src/services/production-order.service.ts`  
**Severidade:** 🔴 Crítica  
**Impacto:** Ordens com datas inválidas, problemas no planejamento

**Problema:**
```typescript
// Linha ~35-64: Método create()
async create(data: CreateProductionOrderDto, userId: string) {
  const order = await prisma.productionOrder.create({
    data: {
      scheduledStart: new Date(data.scheduledStart), // ⚠️ Sem validação
      scheduledEnd: new Date(data.scheduledEnd),     // ⚠️ Sem validação
      // ...
    }
  });
}
```

**Cenário de Falha:**
- Data de fim anterior à data de início
- Datas no passado
- Datas muito distantes (anos)

**Solução:**
```typescript
async create(data: CreateProductionOrderDto, userId: string) {
  const scheduledStart = new Date(data.scheduledStart);
  const scheduledEnd = new Date(data.scheduledEnd);
  
  // Validações
  if (isNaN(scheduledStart.getTime()) || isNaN(scheduledEnd.getTime())) {
    throw new AppError(400, 'Datas inválidas fornecidas');
  }
  
  if (scheduledEnd <= scheduledStart) {
    throw new AppError(400, 'Data de término deve ser posterior à data de início');
  }
  
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  if (scheduledStart < oneDayAgo) {
    throw new AppError(400, 'Data de início não pode ser no passado');
  }
  
  const maxFutureDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 ano
  if (scheduledEnd > maxFutureDate) {
    throw new AppError(400, 'Data de término excede o limite de 1 ano');
  }
  
  // ... resto do código
}
```

---

### 4. **Secrets Expostos em Variáveis de Ambiente**
**Arquivo:** `backend/src/config/env.ts`  
**Severidade:** 🔴 Crítica  
**Impacto:** Vulnerabilidade de segurança severa

**Problema:**
```typescript
export const config = {
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret', // ⚠️ CRÍTICO!
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'default-refresh-secret', // ⚠️ CRÍTICO!
  }
}
```

**Cenário de Falha:**
- Se variáveis de ambiente não forem definidas, usa valores padrão
- Atacantes podem forjar tokens JWT facilmente
- Sistema completamente comprometido

**Solução:**
```typescript
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    console.error(`❌ ERRO CRÍTICO: Variável de ambiente ${key} não definida!`);
    process.exit(1);
  }
  return value;
}

export const config = {
  jwt: {
    secret: requireEnv('JWT_SECRET'),
    refreshSecret: requireEnv('JWT_REFRESH_SECRET'),
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  databaseUrl: requireEnv('DATABASE_URL'),
  // ... outros configs
}
```

---

### 5. **SQL Injection via Query Raw**
**Arquivo:** `backend/src/services/notification.service.ts`  
**Severidade:** 🔴 Crítica  
**Impacto:** Injeção de SQL, comprometimento do banco

**Problema:**
```typescript
// Linha ~334
const dailyTrend = await prisma.$queryRaw<Array<...>>`
  SELECT 
    DATE(createdAt) as date,
    COUNT(*) as count,
    SUM(CASE WHEN priority >= 3 THEN 1 ELSE 0 END) as critical
  FROM notifications
  WHERE userId = ${userId}  // ⚠️ Interpolação direta!
    AND createdAt >= ${since}
  GROUP BY DATE(createdAt)
  ORDER BY date ASC
`;
```

**Cenário de Falha:**
- Se `userId` vier de fonte não confiável, pode conter SQL malicioso
- Possível exfiltração de dados
- Possível modificação/exclusão de dados

**Solução:**
```typescript
const dailyTrend = await prisma.notification.groupBy({
  by: ['createdAt'],
  where: {
    userId,
    createdAt: { gte: since }
  },
  _count: true,
  _sum: {
    priority: true
  }
});

// OU se REALMENTE precisar de raw query:
const dailyTrend = await prisma.$queryRaw`
  SELECT 
    DATE(createdAt) as date,
    COUNT(*) as count,
    SUM(CASE WHEN priority >= 3 THEN 1 ELSE 0 END) as critical
  FROM notifications
  WHERE userId = ${Prisma.sql`${userId}`}
    AND createdAt >= ${Prisma.sql`${since}`}
  GROUP BY DATE(createdAt)
  ORDER BY date ASC
`;
```

---

### 6. **Falta de Validação de Quantidade em parseInt**
**Arquivo:** Múltiplos controladores  
**Severidade:** 🔴 Crítica  
**Impacto:** NaN em queries, erros silenciosos

**Problema:**
```typescript
// Padrão em ~20+ controladores
const page = parseInt(req.query.page as string) || 1;
const limit = parseInt(req.query.limit as string) || 100;
```

**Cenário de Falha:**
- `req.query.page = "abc"` → `parseInt("abc")` = `NaN` → default `1` ✅
- `req.query.page = "-5"` → `parseInt("-5")` = `-5` ❌ (valores negativos passam!)
- `req.query.limit = "999999"` → pode sobrecarregar banco

**Solução:**
```typescript
// Criar helper de validação
function parsePositiveInt(value: any, defaultValue: number, max?: number): number {
  const parsed = parseInt(value);
  
  if (isNaN(parsed) || parsed < 1) {
    return defaultValue;
  }
  
  if (max && parsed > max) {
    return max;
  }
  
  return parsed;
}

// Usar nos controladores
const page = parsePositiveInt(req.query.page, 1);
const limit = parsePositiveInt(req.query.limit, 100, 500); // máximo 500
```

---

### 7. **Validação de JSON.parse sem try-catch**
**Arquivo:** `backend/src/controllers/mrp.controller.ts`  
**Severidade:** 🔴 Crítica  
**Impacto:** Crash do servidor

**Problema:**
```typescript
// Linha ~47
const orderIds = req.query.orderIds ? JSON.parse(req.query.orderIds as string) : undefined;
```

**Cenário de Falha:**
- Cliente envia `orderIds=malformed{json`
- `JSON.parse()` lança exceção
- Servidor pode crashar se não houver error handler

**Solução:**
```typescript
let orderIds: string[] | undefined;

if (req.query.orderIds) {
  try {
    const parsed = JSON.parse(req.query.orderIds as string);
    
    if (!Array.isArray(parsed)) {
      throw new AppError(400, 'orderIds deve ser um array');
    }
    
    if (!parsed.every(id => typeof id === 'string' && id.length > 0)) {
      throw new AppError(400, 'orderIds deve conter apenas strings válidas');
    }
    
    orderIds = parsed;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(400, 'orderIds inválido: JSON malformado');
  }
}
```

---

### 8. **TODO Crítico Não Implementado em Custo de Produto**
**Arquivo:** `backend/src/services/purchase-receipt.service.ts`  
**Severidade:** 🔴 Crítica  
**Impacto:** Custos incorretos, decisões financeiras erradas

**Problema:**
```typescript
// Linha ~174
const currentStock = 0; // TODO: Buscar estoque real
```

**Cenário de Falha:**
- Sempre usa 0 como estoque atual
- Custo médio sempre será o custo do último recebimento
- Não reflete a realidade do estoque
- Pode causar prejuízo financeiro

**Solução:**
```typescript
private async updateProductCosts(items: any[]) {
  for (const item of items) {
    const product = await prisma.product.findUnique({
      where: { id: item.productId },
    });

    if (!product) continue;

    // ✅ IMPLEMENTAR: Buscar estoque real
    const movements = await prisma.stockMovement.findMany({
      where: { productId: item.productId }
    });
    
    let currentStock = 0;
    for (const mov of movements) {
      if (mov.type === 'IN' || mov.type === 'ADJUSTMENT') {
        currentStock += mov.quantity;
      } else if (mov.type === 'OUT') {
        currentStock -= mov.quantity;
      }
    }
    
    const currentValue = (product.averageCost || 0) * currentStock;
    const newStock = currentStock + item.quantityReceived;
    const newValue = currentValue + (item.orderItem.unitPrice * item.quantityReceived);
    const newAverageCost = newStock > 0 ? newValue / newStock : item.orderItem.unitPrice;

    await prisma.product.update({
      where: { id: item.productId },
      data: {
        lastCost: item.orderItem.unitPrice,
        averageCost: newAverageCost,
      },
    });
  }
}
```

---

## 🟠 FALHAS MÉDIAS (Prioridade Média)

### 9. **N+1 Query Problem em MRP**
**Arquivo:** `backend/src/services/mrp.service.ts`  
**Severidade:** 🟠 Média  
**Impacto:** Performance degradada, timeout em grandes volumes

**Problema:**
```typescript
// Linha ~256-281
for (const movement of movements) {
  if (movement.type === 'IN') {
    balance += movement.quantity;
  } else if (movement.type === 'OUT') {
    balance -= movement.quantity;
  }
}
```

**Cenário de Falha:**
- Se houver 100 produtos em uma BOM
- Cada produto busca TODAS suas movimentações
- 100 × queries podem ser pesadas
- Em ordens grandes, pode causar timeout

**Solução:**
```typescript
private async getAvailableStockBatch(productIds: string[]): Promise<Map<string, number>> {
  const movements = await prisma.stockMovement.findMany({
    where: { productId: { in: productIds } },
    select: { productId: true, type: true, quantity: true }
  });
  
  const balances = new Map<string, number>();
  
  for (const productId of productIds) {
    balances.set(productId, 0);
  }
  
  for (const movement of movements) {
    const current = balances.get(movement.productId) || 0;
    if (movement.type === 'IN') {
      balances.set(movement.productId, current + movement.quantity);
    } else if (movement.type === 'OUT') {
      balances.set(movement.productId, current - movement.quantity);
    }
  }
  
  return balances;
}

// Usar no executeForOrder
const productIds = activeBom.items.map(i => i.component.id);
const stockBalances = await this.getAvailableStockBatch(productIds);

for (const bomItem of activeBom.items) {
  const availableQty = stockBalances.get(bomItem.component.id) || 0;
  // ... resto do código
}
```

---

### 10. **Falta de Índices em Queries Frequentes**
**Arquivo:** `backend/prisma/schema.prisma`  
**Severidade:** 🟠 Média  
**Impacto:** Queries lentas em produção

**Problema:**
```prisma
model StockMovement {
  // ... campos ...
  @@index([productId])
  @@index([type])
  @@index([createdAt])
  @@index([reference])
  // ⚠️ Faltam índices compostos para queries frequentes
}
```

**Solução:**
```prisma
model StockMovement {
  // ... campos ...
  
  // Índices simples
  @@index([productId])
  @@index([type])
  @@index([createdAt])
  @@index([reference])
  
  // Índices compostos para queries frequentes
  @@index([productId, type])
  @@index([productId, createdAt])
  @@index([reference, referenceType])
  @@index([userId, createdAt])
  
  @@map("stock_movements")
}

model ProductionOrder {
  // ... campos ...
  
  @@index([status])
  @@index([scheduledStart])
  @@index([productId])
  
  // Adicionar índices compostos
  @@index([status, scheduledStart])
  @@index([productId, status])
  @@index([createdBy, status])
  
  @@map("production_orders")
}

model Notification {
  // ... campos ...
  
  @@index([userId, read])
  @@index([userId, archived])
  @@index([category])
  @@index([eventType])
  @@index([priority])
  @@index([createdAt])
  @@index([resourceType, resourceId])
  
  // Adicionar índices compostos
  @@index([userId, read, createdAt])
  @@index([userId, archived, priority])
  @@index([category, priority, createdAt])
  
  @@map("notifications")
}
```

---

### 11. **Falta de Paginação em Endpoints de Lista**
**Arquivo:** `backend/src/services/stock.service.ts`  
**Severidade:** 🟠 Média  
**Impacto:** OOM em grandes volumes

**Problema:**
```typescript
// Linha ~170-209
async getAllBalances(filters?: {...}): Promise<StockBalance[]> {
  const products = await prisma.product.findMany({
    where,
    include: { category: true, unit: true }
  }); // ⚠️ Sem limite, pode retornar milhares de produtos!
  
  for (const product of products) {
    const balance = await this.getBalance(product.id); // ⚠️ N+1 query
    balances.push(balance);
  }
}
```

**Solução:**
```typescript
async getAllBalances(
  page = 1,
  limit = 100,
  filters?: {...}
): Promise<{ balances: StockBalance[], pagination: any }> {
  const skip = (page - 1) * limit;
  
  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { category: true, unit: true },
      skip,
      take: Math.min(limit, 500), // máximo 500
      orderBy: { code: 'asc' }
    }),
    prisma.product.count({ where })
  ]);
  
  const balances: StockBalance[] = [];
  const productIds = products.map(p => p.id);
  
  // Buscar movimentações em batch
  const movements = await prisma.stockMovement.findMany({
    where: { productId: { in: productIds } },
    select: { productId: true, type: true, quantity: true }
  });
  
  // Calcular balances
  for (const product of products) {
    const productMovements = movements.filter(m => m.productId === product.id);
    let quantity = 0;
    
    for (const mov of productMovements) {
      if (mov.type === 'IN' || mov.type === 'ADJUSTMENT') {
        quantity += mov.quantity;
      } else if (mov.type === 'OUT') {
        quantity -= mov.quantity;
      }
    }
    
    // ... calcular status e adicionar ao balances
  }
  
  return {
    balances,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
}
```

---

### 12. **Console.logs em Produção**
**Arquivo:** Múltiplos arquivos backend  
**Severidade:** 🟠 Média  
**Impacto:** Performance, logs poluídos, informações sensíveis

**Problema:**
- ~50+ `console.log()` espalhados pelo código
- Alguns com informações sensíveis
- Degradam performance em produção

**Exemplos:**
```typescript
// auth.middleware.ts
console.log('🔐 Auth Middleware - Headers:', {...});
console.log('❌ Token não fornecido');
console.log('✅ Token válido para:', decoded.email);
```

**Solução:**
```typescript
// Usar o logger já configurado
import { logger } from '../config/logger';

// auth.middleware.ts
logger.debug('Auth Middleware - Headers:', {...});
logger.warn('Token não fornecido');
logger.info('Token válido para:', decoded.email);

// O logger já está configurado para:
// - Não logar DEBUG em produção
// - Rotacionar logs
// - Formatar adequadamente
```

---

### 13. **Falta de Rate Limiting**
**Arquivo:** `backend/src/app.ts`  
**Severidade:** 🟠 Média  
**Impacto:** Vulnerável a ataques de força bruta, DDoS

**Problema:**
```typescript
// app.ts - Sem rate limiting
app.use(helmet());
app.use(cors({ ... }));
app.use(express.json());
// ⚠️ Qualquer cliente pode fazer quantas requisições quiser
```

**Solução:**
```typescript
import rateLimit from 'express-rate-limit';

// Rate limiting geral
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por IP
  message: 'Muitas requisições deste IP, tente novamente em 15 minutos',
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting rigoroso para login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // máximo 5 tentativas de login
  skipSuccessfulRequests: true,
  message: 'Muitas tentativas de login, tente novamente em 15 minutos',
});

app.use('/api/v1', generalLimiter);
app.use('/api/v1/auth/login', loginLimiter);
```

---

### 14. **Falta de Validação de Permissões em Operações Críticas**
**Arquivo:** `backend/src/controllers/purchase-order.controller.ts`  
**Severidade:** 🟠 Média  
**Impacto:** Usuários podem aprovar próprios pedidos

**Problema:**
```typescript
// Linha ~95-110
async approve(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.userId!;
    const result = await purchaseOrderService.approve(req.params.id, userId, req.body);
    // ⚠️ Não verifica se usuário pode aprovar
    // ⚠️ Não verifica se usuário é o criador do pedido
  }
}
```

**Solução:**
```typescript
async approve(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.userId!;
    const orderId = req.params.id;
    
    // Buscar pedido
    const order = await prisma.purchaseOrder.findUnique({
      where: { id: orderId },
      select: { createdBy: true, status: true }
    });
    
    if (!order) {
      return res.status(404).json({ 
        status: 'error', 
        message: 'Pedido não encontrado' 
      });
    }
    
    // Verificar se não é o próprio criador
    if (order.createdBy === userId) {
      return res.status(403).json({ 
        status: 'error', 
        message: 'Você não pode aprovar seu próprio pedido' 
      });
    }
    
    // Verificar se já foi aprovado
    if (order.status === 'APPROVED') {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Pedido já foi aprovado' 
      });
    }
    
    const result = await purchaseOrderService.approve(orderId, userId, req.body);
    
    return res.status(200).json({
      status: 'success',
      message: 'Pedido aprovado com sucesso',
      data: result
    });
  } catch (error) {
    return next(error);
  }
}
```

---

### 15. **Falta de Cleanup de Logs Antigos**
**Arquivo:** `backend/prisma/schema.prisma`  
**Severidade:** 🟠 Média  
**Impacto:** Banco de dados crescendo indefinidamente

**Problema:**
- Tabela `audit_logs` não tem política de retenção
- Pode crescer para milhões de registros
- Impacta performance de queries

**Solução:**
```typescript
// backend/src/jobs/cleanup-logs.job.ts
import cron from 'node-cron';
import { prisma } from '../config/database';
import { logger } from '../config/logger';

export class LogCleanupJob {
  private job: cron.ScheduledTask | null = null;

  start() {
    // Executar todo dia às 2h da manhã
    this.job = cron.schedule('0 2 * * *', async () => {
      try {
        logger.info('🧹 Iniciando limpeza de logs antigos...');
        
        const retentionDays = 90; // Manter 90 dias
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
        
        const deleted = await prisma.auditLog.deleteMany({
          where: {
            createdAt: {
              lt: cutoffDate
            }
          }
        });
        
        logger.info(`✅ ${deleted.count} logs antigos removidos`);
      } catch (error) {
        logger.error('❌ Erro na limpeza de logs:', error);
      }
    });
    
    logger.info('✅ Job de limpeza de logs iniciado');
  }

  stop() {
    if (this.job) {
      this.job.stop();
      logger.info('🛑 Job de limpeza de logs parado');
    }
  }
}

export default new LogCleanupJob();

// Adicionar em server.ts
import logCleanupJob from './jobs/cleanup-logs.job';
logCleanupJob.start();
```

---

### 16-23. **Outras Falhas Médias Identificadas**

16. **Falta de timeout em queries do Prisma** - Pode travar em queries lentas
17. **Falta de validação de tipos de arquivo em uploads** (se houver)
18. **Falta de HTTPS enforcement** em produção
19. **Logs de erro não incluem stack trace em dev**
20. **Falta de health check detalhado** (apenas status: ok)
21. **Falta de graceful degradation** em falhas de serviços externos
22. **Falta de backup automático** do banco de dados
23. **Falta de monitoramento de performance** (APM)

---

## 🟡 FALHAS BAIXAS (Melhorias Recomendadas)

### 24. **Logs Sensíveis no Frontend**
**Arquivo:** `frontend/src/stores/auth.store.ts`  
**Severidade:** 🟡 Baixa  
**Impacto:** Informações sensíveis no console do navegador

**Problema:**
```typescript
console.log('AuthStore: Resposta recebida:', response)
// Pode logar tokens e dados sensíveis
```

**Solução:**
```typescript
// Remover em produção ou sanitizar
if (import.meta.env.DEV) {
  console.log('AuthStore: Login bem-sucedido!');
}
```

---

### 25. **Falta de Debounce em Campos de Busca**
**Impacto:** UX ruim, muitas requisições desnecessárias

**Solução:** Implementar debounce de 300ms em campos de busca

---

### 26. **Mensagens de Erro Genéricas para Usuário**
**Impacto:** UX ruim, usuário não sabe o que fazer

**Solução:** Mensagens mais específicas e acionáveis

---

### 27-32. **Outras Melhorias**

27. Adicionar loading states em todas as ações
28. Implementar retry logic em falhas de rede
29. Adicionar confirmação em ações destrutivas
30. Melhorar feedback visual de erros
31. Implementar cache de dados frequentes
32. Adicionar testes automatizados

---

## 📋 Plano de Ação Recomendado

### Fase 1 - Crítico (1-2 semanas)
1. ✅ Implementar transações em operações de estoque
2. ✅ Corrigir validações de JWT secrets
3. ✅ Corrigir SQL injection
4. ✅ Implementar validações de entrada
5. ✅ Corrigir TODO crítico de custos

### Fase 2 - Médio (2-4 semanas)
6. Otimizar queries N+1
7. Adicionar índices de banco
8. Implementar rate limiting
9. Adicionar paginação em todos os endpoints
10. Implementar validações de permissões

### Fase 3 - Baixo (Backlog)
11. Remover console.logs
12. Melhorar mensagens de erro
13. Adicionar debounce
14. Implementar testes automatizados
15. Adicionar monitoramento

---

## 🎯 Conclusão

O sistema apresenta uma base sólida, mas possui **8 falhas críticas** que podem comprometer:
- **Integridade dos dados** (race conditions)
- **Segurança** (JWT defaults, SQL injection)
- **Fiabilidade financeira** (custos incorretos)

**Recomendação:** Priorizar a Fase 1 imediatamente antes de ir para produção.

---

**Analista:** GitHub Copilot (Claude Sonnet 4.5)  
**Data:** 22/10/2025
