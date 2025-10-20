# 🔍 Análise Detalhada - Fase 1 de Melhorias

## 📊 Status Atual do Fabric (Análise Completa)

Data: 20/10/2025  
Versão Analisada: Atual

---

## 1️⃣ INTEGRAÇÃO INTERNA

### **Status Atual: ❌ NÃO IMPLEMENTADO (0%)**

#### **O que existe:**
- ✅ Módulos independentes funcionais
- ✅ API REST bem estruturada
- ✅ Banco de dados relacional

#### **O que NÃO existe:**
- ❌ **Event Bus** - Nenhum sistema de eventos
- ❌ **Sincronização Automática** - Módulos não se comunicam
- ❌ **Consumo Automático de Materiais** - Apontamento não atualiza estoque
- ❌ **Notificações em Tempo Real** - Sem WebSockets
- ❌ **Triggers de Integração** - Sem ações automáticas

#### **Problemas Identificados:**

```typescript
// PROBLEMA 1: Apontamento não consome estoque
// Arquivo: production-pointing.service.ts
async create(data: CreateProductionPointingDto, userId: string) {
  // Cria apontamento
  const pointing = await prisma.productionPointing.create({...});
  
  // ❌ NÃO FAZ:
  // - Consumo de materiais da BOM
  // - Atualização de estoque
  // - Notificação de conclusão
  // - Atualização de status da OP
}
```

```typescript
// PROBLEMA 2: Pedido de compra não atualiza estoque
// Arquivo: purchase-order.service.ts
async confirm(id: string) {
  // Confirma pedido
  return this.updateStatus(id, 'CONFIRMED');
  
  // ❌ NÃO FAZ:
  // - Entrada automática no estoque ao receber
  // - Atualização de custos
  // - Notificação de recebimento
}
```

```typescript
// PROBLEMA 3: Estoque é simulado
// Arquivo: stock.service.ts
async getBalance(productId: string) {
  // TODO: Calcular saldo real baseado em movimentações
  // Por enquanto, retorna valores simulados
  const quantity = Math.floor(Math.random() * 200); // ❌ SIMULADO!
}
```

#### **O que precisa ser desenvolvido:**

**1.1 Event Bus (Sistema de Eventos)**
```typescript
// events/event-bus.ts
class EventBus {
  emit(event: string, data: any): void
  on(event: string, handler: Function): void
  off(event: string, handler: Function): void
}

// Eventos necessários:
- 'production.pointing.created'
- 'production.pointing.finished'
- 'production.order.completed'
- 'purchase.order.received'
- 'stock.movement.created'
- 'stock.level.low'
- 'stock.level.critical'
```

**1.2 Consumo Automático de Materiais**
```typescript
// services/material-consumption.service.ts
class MaterialConsumptionService {
  // Ao apontar produção, consumir materiais da BOM
  async consumeMaterials(pointingId: string): Promise<void>
  
  // Reverter consumo se apontamento for cancelado
  async reverseMaterialConsumption(pointingId: string): Promise<void>
  
  // Calcular consumo real vs teórico
  async calculateConsumptionVariance(orderId: string): Promise<Report>
}
```

**1.3 Integração Estoque Real**
```typescript
// services/stock.service.ts - REFATORAR
class StockService {
  // Calcular saldo REAL baseado em movimentações
  async getBalance(productId: string): Promise<StockBalance> {
    const movements = await prisma.stockMovement.findMany({
      where: { productId }
    });
    
    const balance = movements.reduce((acc, mov) => {
      return mov.type === 'IN' 
        ? acc + mov.quantity 
        : acc - mov.quantity;
    }, 0);
    
    return { ...balance };
  }
  
  // Registrar entrada automática ao receber compra
  async registerPurchaseReceipt(orderId: string): Promise<void>
  
  // Registrar saída automática ao apontar produção
  async registerProductionConsumption(pointingId: string): Promise<void>
}
```

**Esforço Estimado:** 2-3 semanas  
**Prioridade:** 🔴 CRÍTICA

---

## 2️⃣ MRP (Material Requirements Planning)

### **Status Atual: ✅ IMPLEMENTADO (80%)**

#### **O que JÁ existe:**
- ✅ Explosão de BOM
- ✅ Cálculo de necessidades brutas
- ✅ Cálculo de necessidades líquidas
- ✅ Sugestões de compra/produção
- ✅ Consideração de lead time
- ✅ API funcional

#### **Código Existente:**
```typescript
// services/mrp.service.ts - JÁ IMPLEMENTADO!
class MRPService {
  ✅ async executeForOrder(orderId: string): Promise<MRPResult>
  ✅ async executeBatch(orderIds: string[]): Promise<MRPResult[]>
  ✅ async consolidateRequirements(results: MRPResult[]): Promise<ConsolidatedRequirement[]>
  ✅ private async getAvailableStock(productId: string): Promise<number>
  ✅ private async getOnOrderQuantity(productId: string): Promise<number>
}
```

#### **O que precisa MELHORAR:**

**2.1 Integração com Estoque Real**
```typescript
// PROBLEMA: Usa estoque simulado
private async getAvailableStock(productId: string): Promise<number> {
  // TODO: Implementar consulta real ao estoque
  return 100; // ❌ VALOR FIXO
}

// SOLUÇÃO: Integrar com stock.service
private async getAvailableStock(productId: string): Promise<number> {
  const balance = await stockService.getBalance(productId);
  return balance.quantity; // ✅ VALOR REAL
}
```

**2.2 Integração com Pedidos de Compra**
```typescript
// PROBLEMA: Não considera pedidos reais
private async getOnOrderQuantity(productId: string): Promise<number> {
  // TODO: Buscar pedidos de compra em aberto
  return 0; // ❌ SEMPRE ZERO
}

// SOLUÇÃO: Buscar pedidos confirmados
private async getOnOrderQuantity(productId: string): Promise<number> {
  const orders = await prisma.purchaseOrderItem.findMany({
    where: {
      productId,
      order: { status: { in: ['APPROVED', 'CONFIRMED'] } }
    }
  });
  
  return orders.reduce((sum, item) => 
    sum + (item.quantity - item.receivedQty), 0
  ); // ✅ QUANTIDADE REAL EM PEDIDOS
}
```

**2.3 Geração Automática de Pedidos**
```typescript
// NOVO: Gerar pedidos automaticamente a partir do MRP
class MRPService {
  async generatePurchaseOrders(
    mrpResult: MRPResult
  ): Promise<PurchaseOrder[]> {
    const orders: PurchaseOrder[] = [];
    
    for (const req of mrpResult.requirements) {
      if (req.suggestedAction === 'BUY' && req.netRequirement > 0) {
        // Agrupar por fornecedor
        // Criar pedido de compra
        const order = await purchaseOrderService.create({
          supplierId: req.preferredSupplierId,
          expectedDate: req.suggestedDate,
          items: [{
            productId: req.productId,
            quantity: req.netRequirement,
            unitPrice: req.lastCost
          }]
        });
        
        orders.push(order);
      }
    }
    
    return orders;
  }
}
```

**Esforço Estimado:** 1 semana (melhorias)  
**Prioridade:** 🟡 MÉDIA (já funciona, mas precisa integrar)

---

## 3️⃣ CRP (Capacity Requirements Planning)

### **Status Atual: ❌ NÃO IMPLEMENTADO (0%)**

#### **O que existe:**
- ✅ Centros de trabalho cadastrados
- ✅ Roteiros de produção
- ✅ Operações com tempos estimados
- ✅ Ordens de produção com datas

#### **O que NÃO existe:**
- ❌ **Cálculo de Capacidade Disponível**
- ❌ **Cálculo de Capacidade Necessária**
- ❌ **Identificação de Gargalos**
- ❌ **Simulação de Cenários**
- ❌ **Balanceamento de Carga**

#### **O que precisa ser desenvolvido:**

**3.1 Service de CRP**
```typescript
// services/crp.service.ts - CRIAR
export interface CapacityRequirement {
  workCenterId: string;
  workCenter: any;
  date: Date;
  availableCapacity: number; // minutos
  requiredCapacity: number;  // minutos
  utilizationRate: number;   // %
  overload: number;          // minutos
  status: 'OK' | 'WARNING' | 'OVERLOAD';
  orders: {
    orderId: string;
    orderNumber: string;
    operationId: string;
    operationName: string;
    requiredTime: number;
  }[];
}

export interface Bottleneck {
  workCenterId: string;
  workCenter: any;
  period: { start: Date; end: Date };
  avgUtilization: number;
  maxUtilization: number;
  overloadDays: number;
  impact: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

class CRPService {
  // Calcular capacidade disponível de um centro
  async getAvailableCapacity(
    workCenterId: string,
    date: Date
  ): Promise<number> {
    const workCenter = await prisma.workCenter.findUnique({
      where: { id: workCenterId }
    });
    
    // Capacidade = horas/dia * 60 * eficiência
    const dailyMinutes = workCenter.hoursPerDay * 60;
    const availableMinutes = dailyMinutes * (workCenter.efficiency / 100);
    
    return availableMinutes;
  }
  
  // Calcular capacidade necessária
  async getRequiredCapacity(
    workCenterId: string,
    startDate: Date,
    endDate: Date
  ): Promise<CapacityRequirement[]> {
    // Buscar operações programadas para o período
    const operations = await prisma.productionOrderOperation.findMany({
      where: {
        workCenterId,
        scheduledStart: { gte: startDate, lte: endDate },
        status: { in: ['PENDING', 'IN_PROGRESS'] }
      },
      include: {
        productionOrder: true
      }
    });
    
    // Agrupar por dia
    const requirements: Map<string, CapacityRequirement> = new Map();
    
    for (const op of operations) {
      const dateKey = op.scheduledStart.toISOString().split('T')[0];
      
      if (!requirements.has(dateKey)) {
        const available = await this.getAvailableCapacity(
          workCenterId, 
          op.scheduledStart
        );
        
        requirements.set(dateKey, {
          workCenterId,
          date: op.scheduledStart,
          availableCapacity: available,
          requiredCapacity: 0,
          utilizationRate: 0,
          overload: 0,
          status: 'OK',
          orders: []
        });
      }
      
      const req = requirements.get(dateKey)!;
      req.requiredCapacity += op.standardTime;
      req.orders.push({
        orderId: op.productionOrderId,
        orderNumber: op.productionOrder.orderNumber,
        operationId: op.id,
        operationName: op.operationName,
        requiredTime: op.standardTime
      });
    }
    
    // Calcular utilização e status
    requirements.forEach(req => {
      req.utilizationRate = (req.requiredCapacity / req.availableCapacity) * 100;
      req.overload = Math.max(0, req.requiredCapacity - req.availableCapacity);
      
      if (req.utilizationRate > 100) {
        req.status = 'OVERLOAD';
      } else if (req.utilizationRate > 90) {
        req.status = 'WARNING';
      } else {
        req.status = 'OK';
      }
    });
    
    return Array.from(requirements.values());
  }
  
  // Identificar gargalos
  async identifyBottlenecks(
    startDate: Date,
    endDate: Date
  ): Promise<Bottleneck[]> {
    const workCenters = await prisma.workCenter.findMany({
      where: { active: true }
    });
    
    const bottlenecks: Bottleneck[] = [];
    
    for (const wc of workCenters) {
      const requirements = await this.getRequiredCapacity(
        wc.id,
        startDate,
        endDate
      );
      
      if (requirements.length === 0) continue;
      
      const avgUtilization = requirements.reduce(
        (sum, r) => sum + r.utilizationRate, 0
      ) / requirements.length;
      
      const maxUtilization = Math.max(
        ...requirements.map(r => r.utilizationRate)
      );
      
      const overloadDays = requirements.filter(
        r => r.status === 'OVERLOAD'
      ).length;
      
      // Determinar impacto
      let impact: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
      if (maxUtilization > 150 || overloadDays > 5) {
        impact = 'CRITICAL';
      } else if (maxUtilization > 120 || overloadDays > 3) {
        impact = 'HIGH';
      } else if (maxUtilization > 100 || overloadDays > 0) {
        impact = 'MEDIUM';
      }
      
      if (avgUtilization > 80 || overloadDays > 0) {
        bottlenecks.push({
          workCenterId: wc.id,
          workCenter: wc,
          period: { start: startDate, end: endDate },
          avgUtilization,
          maxUtilization,
          overloadDays,
          impact
        });
      }
    }
    
    // Ordenar por impacto
    return bottlenecks.sort((a, b) => {
      const impactOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
      return impactOrder[b.impact] - impactOrder[a.impact];
    });
  }
  
  // Simular cenário
  async simulateScenario(
    orderId: string,
    newScheduledStart: Date
  ): Promise<{
    feasible: boolean;
    conflicts: any[];
    recommendations: string[];
  }> {
    // Buscar operações da ordem
    const operations = await prisma.productionOrderOperation.findMany({
      where: { productionOrderId: orderId }
    });
    
    const conflicts: any[] = [];
    const recommendations: string[] = [];
    
    // Para cada operação, verificar capacidade
    let currentDate = new Date(newScheduledStart);
    
    for (const op of operations) {
      const requirements = await this.getRequiredCapacity(
        op.workCenterId,
        currentDate,
        currentDate
      );
      
      const dayReq = requirements[0];
      
      if (dayReq && dayReq.status === 'OVERLOAD') {
        conflicts.push({
          operationId: op.id,
          workCenterId: op.workCenterId,
          date: currentDate,
          overload: dayReq.overload
        });
        
        recommendations.push(
          `Operação ${op.operationName} causará sobrecarga de ${dayReq.overload} minutos`
        );
      }
      
      // Avançar para próxima operação
      currentDate = new Date(currentDate);
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return {
      feasible: conflicts.length === 0,
      conflicts,
      recommendations
    };
  }
}
```

**3.2 Controller e Rotas**
```typescript
// controllers/crp.controller.ts
class CRPController {
  async getCapacityRequirements(req, res) {}
  async identifyBottlenecks(req, res) {}
  async simulateScenario(req, res) {}
}

// routes/crp.routes.ts
router.get('/capacity-requirements', crpController.getCapacityRequirements);
router.get('/bottlenecks', crpController.identifyBottlenecks);
router.post('/simulate', crpController.simulateScenario);
```

**3.3 Frontend**
```typescript
// views/crp/CRPView.vue
- Gráfico de capacidade por centro
- Lista de gargalos
- Simulador de cenários
- Recomendações de balanceamento
```

**Esforço Estimado:** 2-3 semanas  
**Prioridade:** 🟡 MÉDIA

---

## 4️⃣ MELHORIAS NO APONTAMENTO

### **Status Atual: ⚠️ FUNCIONAL MAS LIMITADO (60%)**

#### **O que existe:**
- ✅ Registro de apontamentos
- ✅ Cálculo de tempos
- ✅ Registro de refugo
- ✅ API funcional

#### **O que precisa MELHORAR:**

**4.1 Interface Otimizada**
```vue
<!-- views/production/ProductionPointingView.vue - MELHORAR -->
<template>
  <!-- Adicionar: -->
  - ✅ Timer em tempo real
  - ✅ Início/pausa/fim com um clique
  - ✅ Validação de quantidade vs OP
  - ✅ Alerta de refugo alto
  - ✅ Histórico de apontamentos
  - ✅ Foto/evidência (opcional)
</template>
```

**4.2 Validações**
```typescript
// services/production-pointing.service.ts - ADICIONAR
class ProductionPointingService {
  async create(data: CreateProductionPointingDto, userId: string) {
    // VALIDAÇÃO 1: Quantidade não pode exceder OP
    const order = await prisma.productionOrder.findUnique({
      where: { id: data.productionOrderId }
    });
    
    const totalPointed = await this.getTotalPointed(data.productionOrderId);
    
    if (totalPointed + data.goodQuantity > order.quantity) {
      throw new Error(
        `Quantidade apontada (${totalPointed + data.goodQuantity}) ` +
        `excede quantidade da OP (${order.quantity})`
      );
    }
    
    // VALIDAÇÃO 2: Operação deve estar em sequência
    const previousOp = await this.getPreviousOperation(data.operationId);
    if (previousOp && previousOp.status !== 'COMPLETED') {
      throw new Error(
        `Operação anterior (${previousOp.operationName}) ` +
        `ainda não foi concluída`
      );
    }
    
    // VALIDAÇÃO 3: Refugo alto
    const scrapRate = (data.scrapQuantity / data.goodQuantity) * 100;
    if (scrapRate > 10) {
      // Registrar alerta
      await this.createQualityAlert({
        pointingId: pointing.id,
        type: 'HIGH_SCRAP',
        value: scrapRate,
        threshold: 10
      });
    }
    
    // Criar apontamento
    const pointing = await prisma.productionPointing.create({...});
    
    // ✅ INTEGRAÇÃO: Consumir materiais
    await materialConsumptionService.consumeMaterials(pointing.id);
    
    // ✅ INTEGRAÇÃO: Atualizar status da operação
    await this.updateOperationStatus(data.operationId);
    
    // ✅ INTEGRAÇÃO: Verificar conclusão da OP
    await this.checkOrderCompletion(data.productionOrderId);
    
    // ✅ EVENT: Emitir evento
    eventBus.emit('production.pointing.created', pointing);
    
    return pointing;
  }
  
  // Calcular total já apontado
  private async getTotalPointed(orderId: string): Promise<number> {
    const pointings = await prisma.productionPointing.findMany({
      where: { productionOrderId: orderId }
    });
    
    return pointings.reduce((sum, p) => sum + p.quantityGood, 0);
  }
  
  // Atualizar status da operação
  private async updateOperationStatus(operationId: string): Promise<void> {
    const operation = await prisma.productionOrderOperation.findUnique({
      where: { id: operationId },
      include: { productionOrder: true }
    });
    
    const totalPointed = await prisma.productionPointing.aggregate({
      where: { operationId },
      _sum: { quantityGood: true }
    });
    
    const pointed = totalPointed._sum.quantityGood || 0;
    const required = operation.productionOrder.quantity;
    
    let status = 'PENDING';
    if (pointed >= required) {
      status = 'COMPLETED';
    } else if (pointed > 0) {
      status = 'IN_PROGRESS';
    }
    
    await prisma.productionOrderOperation.update({
      where: { id: operationId },
      data: { 
        status,
        actualQuantity: pointed
      }
    });
  }
  
  // Verificar se OP foi concluída
  private async checkOrderCompletion(orderId: string): Promise<void> {
    const operations = await prisma.productionOrderOperation.findMany({
      where: { productionOrderId: orderId }
    });
    
    const allCompleted = operations.every(op => op.status === 'COMPLETED');
    
    if (allCompleted) {
      await prisma.productionOrder.update({
        where: { id: orderId },
        data: { 
          status: 'COMPLETED',
          actualEnd: new Date()
        }
      });
      
      // ✅ EVENT: OP concluída
      eventBus.emit('production.order.completed', { orderId });
    }
  }
}
```

**4.3 Integração com Estoque**
```typescript
// services/material-consumption.service.ts - CRIAR
class MaterialConsumptionService {
  async consumeMaterials(pointingId: string): Promise<void> {
    const pointing = await prisma.productionPointing.findUnique({
      where: { id: pointingId },
      include: {
        productionOrder: {
          include: {
            product: {
              include: {
                boms: {
                  where: { active: true },
                  include: { items: { include: { component: true } } }
                }
              }
            }
          }
        }
      }
    });
    
    const bom = pointing.productionOrder.product.boms[0];
    if (!bom) return;
    
    // Para cada material da BOM
    for (const item of bom.items) {
      const consumedQty = item.quantity * pointing.quantityGood;
      
      // Registrar saída de estoque
      await stockService.registerMovement({
        productId: item.componentId,
        type: 'OUT',
        quantity: consumedQty,
        reason: 'Consumo de produção',
        reference: `Apontamento ${pointingId}`,
        userId: pointing.userId
      });
    }
  }
}
```

**Esforço Estimado:** 2 semanas  
**Prioridade:** 🟡 MÉDIA

---

## 📊 RESUMO DA FASE 1

### **Priorização Revisada:**

| Item | Status Atual | Esforço | Prioridade | Ordem |
|------|--------------|---------|------------|-------|
| **1. Integração Interna** | ❌ 0% | 2-3 sem | 🔴 CRÍTICA | 1º |
| **2. MRP** | ✅ 80% | 1 sem | 🟡 MÉDIA | 4º |
| **3. CRP** | ❌ 0% | 2-3 sem | 🟡 MÉDIA | 3º |
| **4. Apontamento** | ⚠️ 60% | 2 sem | 🟡 MÉDIA | 2º |

### **Roadmap Revisado:**

**Semana 1-3: Integração Interna** 🔴
- Event Bus
- Consumo automático de materiais
- Estoque real (não simulado)
- Sincronização entre módulos

**Semana 4-5: Melhorias no Apontamento** 🟡
- Validações robustas
- Interface otimizada
- Integração com estoque
- Atualização automática de status

**Semana 6-8: CRP** 🟡
- Cálculo de capacidade
- Identificação de gargalos
- Simulador de cenários
- Dashboard de capacidade

**Semana 9: MRP - Integração Final** 🟡
- Conectar com estoque real
- Conectar com pedidos reais
- Geração automática de pedidos

---

## ✅ Entregáveis da Fase 1

Ao final de 8-9 semanas, o Fabric terá:

1. ✅ **Integração completa** entre todos os módulos
2. ✅ **Estoque real** com movimentações automáticas
3. ✅ **Apontamento robusto** com validações e integrações
4. ✅ **CRP funcional** com identificação de gargalos
5. ✅ **MRP integrado** com estoque e compras reais

**Resultado:** Sistema PCP **funcional e integrado** pronto para uso em produção! 🎉

---

*Análise realizada em: 20/10/2025*  
*Próximo passo: Iniciar desenvolvimento da Integração Interna*
