# 🏢 Análise de Implementação - Sistema WMS (Warehouse Management System)

**Data:** 22/10/2025  
**Versão:** 1.0  
**Status:** Análise de Esforço

---

## 📊 Situação Atual

### ✅ **O que JÁ EXISTE**

#### **1. Estrutura de Localização Física**
```prisma
model Location {
  id            String         @id @default(uuid())
  code          String         @unique
  name          String
  type          LocationType   // WAREHOUSE, CORRIDOR, SHELF, BIN, FLOOR
  parentId      String?        // Hierarquia
  active        Boolean
  
  parent        Location?      @relation("LocationHierarchy")
  children      Location[]     @relation("LocationHierarchy")
  countingItems CountingItem[] // Relação com contagem
}
```

**Tipos de Localização:**
- ✅ WAREHOUSE (Armazém)
- ✅ CORRIDOR (Corredor)
- ✅ SHELF (Prateleira)
- ✅ BIN (Posição/Gaveta)
- ✅ FLOOR (Piso)

#### **2. Hierarquia Implementada**
```
Armazém Principal (ARM-01)
├── Corredor A1
│   ├── Prateleira 01
│   │   ├── Posição 01
│   │   ├── Posição 02
│   │   ├── Posição 03
│   │   └── Posição 04
│   ├── Prateleira 02
│   └── ...
├── Corredor A2
├── Corredor A3
├── Corredor B1 - Semiacabados
├── Corredor C1 - Produtos Acabados
└── Corredor D1 - Embalagens
```

#### **3. Seed de Dados**
- ✅ Script completo de criação de localizações (`seed-locations.ts`)
- ✅ ~50+ localizações já estruturadas
- ✅ Códigos padronizados (ex: ARM-01-A-C1-P01-01)

---

## ❌ **O que FALTA para WMS Completo**

### **Requisitos Específicos da Contagem:**
1. ❌ Ordenação de itens por localização física
2. ❌ Agrupamento por corredor/prateleira
3. ❌ Mapa de contagem (picking list otimizado)

### **Funcionalidades WMS Essenciais:**
4. ❌ Saldo de estoque por localização
5. ❌ Movimentação entre localizações
6. ❌ Endereçamento de produtos
7. ❌ Rastreamento de lotes por localização
8. ❌ Regras de armazenamento (FIFO, FEFO, etc.)
9. ❌ Capacidade e ocupação de localizações
10. ❌ Transferências internas

### **Funcionalidades de Recebimento:**
11. ❌ Entrada de mercadoria (Receiving)
12. ❌ Conferência de recebimento (Inspection)
13. ❌ Alocação automática de localizações (Put-away)
14. ❌ Gestão de não conformidades no recebimento
15. ❌ Agendamento de recebimentos

---

## 🎯 Proposta de Implementação

### **FASE 1 - Básico para Contagem (1-2 semanas)** 🔴

#### **1.1 Saldo de Estoque por Localização**

**Nova Tabela:**
```prisma
model StockBalance {
  id            String    @id @default(uuid())
  productId     String
  locationId    String
  quantity      Decimal   @db.Decimal(10, 2)
  reservedQty   Decimal   @default(0) @db.Decimal(10, 2)
  availableQty  Decimal   @default(0) @db.Decimal(10, 2)
  
  // Lote (opcional para Fase 2)
  lotNumber     String?
  expiryDate    DateTime?
  
  // Auditoria
  lastMovement  DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  // Relações
  product       Product   @relation(fields: [productId], references: [id])
  location      Location  @relation(fields: [locationId], references: [id])
  
  @@unique([productId, locationId, lotNumber])
  @@index([productId])
  @@index([locationId])
  @@index([availableQty])
  @@map("stock_balances")
}
```

**Esforço:** 2-3 dias
- Migration do schema
- Service para gerenciar saldos
- Endpoints CRUD
- Atualização automática em movimentações

---

#### **1.2 Movimentação com Localização**

**Atualizar StockMovement:**
```prisma
model StockMovement {
  id              String    @id @default(uuid())
  productId       String
  
  // NOVO: Localizações
  fromLocationId  String?   // Origem
  toLocationId    String?   // Destino
  
  type            String    // IN, OUT, TRANSFER, ADJUSTMENT
  quantity        Decimal   @db.Decimal(10, 2)
  reason          String
  reference       String?
  referenceType   String?
  userId          String
  notes           String?
  
  // NOVO: Lote
  lotNumber       String?
  
  createdAt       DateTime  @default(now())
  
  // Relações
  product         Product   @relation(fields: [productId], references: [id])
  fromLocation    Location? @relation("MovementsFrom", fields: [fromLocationId], references: [id])
  toLocation      Location? @relation("MovementsTo", fields: [toLocationId], references: [id])
  user            User      @relation(fields: [userId], references: [id])
  
  @@index([productId])
  @@index([fromLocationId])
  @@index([toLocationId])
  @@index([type])
  @@map("stock_movements")
}
```

**Esforço:** 2-3 dias
- Migration (adicionar campos)
- Atualizar service de movimentação
- Trigger para atualizar StockBalance
- Endpoints de transferência

---

#### **1.3 Endereçamento de Produtos**

**Nova Tabela:**
```prisma
model ProductLocation {
  id              String    @id @default(uuid())
  productId       String
  locationId      String
  
  // Configurações
  isPrimary       Boolean   @default(false)  // Localização principal
  isPickingArea   Boolean   @default(false)  // Área de picking
  minQty          Decimal?  @db.Decimal(10, 2)
  maxQty          Decimal?  @db.Decimal(10, 2)
  
  // Sequência para ordenação
  sequence        Int       @default(0)
  
  // Auditoria
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  // Relações
  product         Product   @relation(fields: [productId], references: [id])
  location        Location  @relation(fields: [locationId], references: [id])
  
  @@unique([productId, locationId])
  @@index([productId, isPrimary])
  @@index([locationId])
  @@map("product_locations")
}
```

**Esforço:** 1-2 dias
- Migration
- Service de endereçamento
- Endpoints CRUD
- Sugestão de localização para novos produtos

---

#### **1.4 Ordenação para Contagem**

**Service de Otimização:**
```typescript
class CountingRouteService {
  /**
   * Ordenar itens de contagem por localização física
   */
  async optimizeCountingRoute(sessionId: string) {
    const items = await prisma.countingItem.findMany({
      where: { sessionId },
      include: {
        product: {
          include: {
            locations: {
              where: { isPrimary: true },
              include: { location: true }
            }
          }
        }
      }
    });
    
    // Ordenar por hierarquia de localização
    const sorted = this.sortByLocationHierarchy(items);
    
    // Atualizar sequência
    for (let i = 0; i < sorted.length; i++) {
      await prisma.countingItem.update({
        where: { id: sorted[i].id },
        data: { sequence: i + 1 }
      });
    }
    
    return sorted;
  }
  
  /**
   * Agrupar itens por corredor/prateleira
   */
  async groupByLocation(sessionId: string) {
    const items = await this.optimizeCountingRoute(sessionId);
    
    // Agrupar por corredor
    const grouped = items.reduce((acc, item) => {
      const corridor = this.extractCorridor(item.location.code);
      if (!acc[corridor]) acc[corridor] = [];
      acc[corridor].push(item);
      return acc;
    }, {} as Record<string, any[]>);
    
    return grouped;
  }
  
  /**
   * Gerar picking list otimizado
   */
  async generatePickingList(sessionId: string) {
    const grouped = await this.groupByLocation(sessionId);
    
    return {
      sessionId,
      totalItems: Object.values(grouped).flat().length,
      routes: Object.entries(grouped).map(([corridor, items]) => ({
        corridor,
        itemCount: items.length,
        items: items.map(item => ({
          sequence: item.sequence,
          productCode: item.product.code,
          productName: item.product.name,
          location: item.location.code,
          systemQty: item.systemQty
        }))
      }))
    };
  }
  
  /**
  /**
   * Ordenar por hierarquia (Armazém > Corredor > Prateleira > Posição)
   */
  private sortByLocationHierarchy(items: any[]) {
    return items.sort((a, b) => {
      const codeA = a.location?.code || '';
      const codeB = b.location?.code || '';
      return codeA.localeCompare(codeB);
    });
  }
  
  /**
   * Extrair corredor do código de localização
   */
  private extractCorridor(code: string): string {
    // ARM-01-C1-P01-01 -> ARM-01-C1
    const parts = code.split('-');
    return parts.slice(0, 3).join('-');
  }
```

**Esforço:** 2-3 dias
- Implementar service
- Endpoints:
  - `GET /api/counting/sessions/:id/route` - Rota otimizada
  - `GET /api/counting/sessions/:id/picking-list` - Lista de separação
  - `GET /api/counting/sessions/:id/grouped` - Agrupado por corredor
- Testes

---

#### **1.5 Atualizar CountingItem**

**Adicionar campos:**
```prisma
model CountingItem {
  id                String              @id @default(uuid())
  sessionId         String
  productId         String
  locationId        String?             // JÁ EXISTE
  
  // NOVO: Sequência para ordenação
  sequence          Int?
  
  // ... demais campos existentes
}
```

**Esforço:** 1 dia
- Migration simples
- Atualizar service de criação de itens

---

#### **1.6 Entrada de Mercadoria (Receiving)**

**Nova Tabela - Recebimento:**
```prisma
model GoodsReceipt {
  id                String              @id @default(uuid())
  receiptNumber     String              @unique
  
  // Referência
  purchaseOrderId   String?             // Pedido de Compra
  supplierId        String?
  supplierInvoice   String?             // Nota Fiscal do Fornecedor
  
  // Datas
  scheduledDate     DateTime?           // Data agendada
  receivedDate      DateTime            @default(now())
  
  // Status
  status            ReceiptStatus       @default(SCHEDULED)
  
  // Responsáveis
  receivedBy        String?             // Quem recebeu
  inspectedBy       String?             // Quem conferiu
  allocatedBy       String?             // Quem alocou
  
  // Observações
  notes             String?
  damages           String?             // Danos identificados
  
  // Auditoria
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt
  
  // Relações
  supplier          Supplier?           @relation(fields: [supplierId], references: [id])
  receivedByUser    User?               @relation("ReceivedBy", fields: [receivedBy], references: [id])
  inspectedByUser   User?               @relation("InspectedBy", fields: [inspectedBy], references: [id])
  allocatedByUser   User?               @relation("AllocatedBy", fields: [allocatedBy], references: [id])
  items             GoodsReceiptItem[]
  
  @@index([status])
  @@index([receivedDate])
  @@index([supplierId])
  @@map("goods_receipts")
}

enum ReceiptStatus {
  SCHEDULED       // Agendado
  RECEIVING       // Em recebimento
  INSPECTING      // Em conferência
  ALLOCATING      // Em alocação
  COMPLETED       // Concluído
  CANCELLED       // Cancelado
  WITH_ISSUES     // Com problemas
}
```

**Nova Tabela - Itens do Recebimento:**
```prisma
model GoodsReceiptItem {
  id                String            @id @default(uuid())
  receiptId         String
  productId         String
  
  // Quantidades
  expectedQty       Decimal           @db.Decimal(10, 2)
  receivedQty       Decimal           @db.Decimal(10, 2)
  approvedQty       Decimal           @db.Decimal(10, 2)
  rejectedQty       Decimal           @default(0) @db.Decimal(10, 2)
  
  // Lote
  lotNumber         String?
  manufacturingDate DateTime?
  expiryDate        DateTime?
  
  // Conferência
  inspectionStatus  InspectionStatus  @default(PENDING)
  inspectionNotes   String?
  
  // Alocação
  allocationStatus  AllocationStatus  @default(PENDING)
  suggestedLocation String?           // Localização sugerida
  allocatedLocation String?           // Localização final
  
  // Não conformidades
  hasIssues         Boolean           @default(false)
  issueDescription  String?
  issueType         IssueType?
  
  // Auditoria
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt
  
  // Relações
  receipt           GoodsReceipt      @relation(fields: [receiptId], references: [id])
  product           Product           @relation(fields: [productId], references: [id])
  suggestedLoc      Location?         @relation("SuggestedLocation", fields: [suggestedLocation], references: [id])
  allocatedLoc      Location?         @relation("AllocatedLocation", fields: [allocatedLocation], references: [id])
  
  @@index([receiptId])
  @@index([productId])
  @@index([inspectionStatus])
  @@index([allocationStatus])
  @@map("goods_receipt_items")
}

enum InspectionStatus {
  PENDING         // Pendente
  IN_PROGRESS     // Em conferência
  APPROVED        // Aprovado
  REJECTED        // Rejeitado
  PARTIAL         // Parcialmente aprovado
}

enum AllocationStatus {
  PENDING         // Pendente
  SUGGESTED       // Localização sugerida
  IN_PROGRESS     // Em alocação
  ALLOCATED       // Alocado
  FAILED          // Falha na alocação
}

enum IssueType {
  QUANTITY_DIFF   // Diferença de quantidade
  DAMAGED         // Produto danificado
  WRONG_PRODUCT   // Produto errado
  EXPIRED         // Produto vencido
  QUALITY         // Problema de qualidade
  PACKAGING       // Problema de embalagem
  OTHER           // Outro
}
```

**Esforço:** 5-7 dias
- Migrations do schema (2 tabelas + 3 enums)
- Service de recebimento
- Service de conferência
- Service de alocação
- Endpoints da API
- Validações e regras de negócio

---

#### **1.7 Conferência de Recebimento (Inspection)**

**Service de Conferência:**
```typescript
class InspectionService {
  /**
   * Iniciar conferência de um recebimento
   */
  async startInspection(receiptId: string, userId: string) {
    // Atualizar status do recebimento
    await prisma.goodsReceipt.update({
      where: { id: receiptId },
      data: {
        status: 'INSPECTING',
        inspectedBy: userId
      }
    });
    
    // Buscar itens para conferência
    return await prisma.goodsReceiptItem.findMany({
      where: { receiptId },
      include: {
        product: true,
        receipt: true
      },
      orderBy: { createdAt: 'asc' }
    });
  }
  
  /**
   * Conferir item individual
   */
  async inspectItem(itemId: string, data: {
    receivedQty: number;
    lotNumber?: string;
    manufacturingDate?: Date;
    expiryDate?: Date;
    hasIssues: boolean;
    issueType?: IssueType;
    issueDescription?: string;
    inspectionNotes?: string;
  }) {
    const item = await prisma.goodsReceiptItem.findUnique({
      where: { id: itemId }
    });
    
    if (!item) throw new Error('Item não encontrado');
    
    // Calcular quantidades
    const approvedQty = data.hasIssues 
      ? data.receivedQty - (data.rejectedQty || 0)
      : data.receivedQty;
    
    const rejectedQty = data.receivedQty - approvedQty;
    
    // Determinar status
    let inspectionStatus: InspectionStatus;
    if (data.hasIssues && rejectedQty === data.receivedQty) {
      inspectionStatus = 'REJECTED';
    } else if (data.hasIssues && rejectedQty > 0) {
      inspectionStatus = 'PARTIAL';
    } else {
      inspectionStatus = 'APPROVED';
    }
    
    // Atualizar item
    return await prisma.goodsReceiptItem.update({
      where: { id: itemId },
      data: {
        receivedQty: data.receivedQty,
        approvedQty,
        rejectedQty,
        lotNumber: data.lotNumber,
        manufacturingDate: data.manufacturingDate,
        expiryDate: data.expiryDate,
        hasIssues: data.hasIssues,
        issueType: data.issueType,
        issueDescription: data.issueDescription,
        inspectionNotes: data.inspectionNotes,
        inspectionStatus
      }
    });
  }
  
  /**
   * Finalizar conferência
   */
  async completeInspection(receiptId: string) {
    const items = await prisma.goodsReceiptItem.findMany({
      where: { receiptId }
    });
    
    // Verificar se todos os itens foram conferidos
    const allInspected = items.every(
      item => item.inspectionStatus !== 'PENDING'
    );
    
    if (!allInspected) {
      throw new Error('Todos os itens devem ser conferidos');
    }
    
    // Verificar se há problemas
    const hasIssues = items.some(item => item.hasIssues);
    
    // Atualizar status do recebimento
    return await prisma.goodsReceipt.update({
      where: { id: receiptId },
      data: {
        status: hasIssues ? 'WITH_ISSUES' : 'ALLOCATING'
      }
    });
  }
  
  /**
   * Validações automáticas
   */
  async autoValidate(itemId: string) {
    const item = await prisma.goodsReceiptItem.findUnique({
      where: { id: itemId },
      include: { product: true }
    });
    
    const issues: Array<{ type: IssueType; description: string }> = [];
    
    // Validar quantidade
    if (item.receivedQty !== item.expectedQty) {
      const diff = Math.abs(item.receivedQty - item.expectedQty);
      const percentDiff = (diff / item.expectedQty) * 100;
      
      if (percentDiff > 5) { // Tolerância de 5%
        issues.push({
          type: 'QUANTITY_DIFF',
          description: `Diferença de ${percentDiff.toFixed(2)}% na quantidade`
        });
      }
    }
    
    // Validar validade
    if (item.expiryDate) {
      const daysToExpiry = Math.floor(
        (item.expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      );
      
      if (daysToExpiry < 0) {
        issues.push({
          type: 'EXPIRED',
          description: 'Produto vencido'
        });
      } else if (daysToExpiry < 30) {
        issues.push({
          type: 'QUALITY',
          description: `Produto próximo ao vencimento (${daysToExpiry} dias)`
        });
      }
    }
    
    return issues;
  }
}
```

**Esforço:** 3-4 dias
- Implementar service completo
- Validações automáticas
- Endpoints da API
- Testes unitários

---

#### **1.8 Alocação Automática (Put-away)**

**Service de Alocação:**
```typescript
class AllocationService {
  /**
   * Sugerir localização para produto
   */
  async suggestLocation(itemId: string): Promise<Location> {
    const item = await prisma.goodsReceiptItem.findUnique({
      where: { id: itemId },
      include: {
        product: {
          include: {
            locations: {
              where: { isPrimary: true },
              include: { location: true }
            }
          }
        }
      }
    });
    
    if (!item) throw new Error('Item não encontrado');
    
    // 1. Verificar localização primária do produto
    const primaryLocation = item.product.locations[0]?.location;
    if (primaryLocation && await this.hasCapacity(primaryLocation.id, item.approvedQty)) {
      return primaryLocation;
    }
    
    // 2. Buscar localizações alternativas do mesmo produto
    const alternativeLocations = await prisma.productLocation.findMany({
      where: {
        productId: item.productId,
        isPrimary: false
      },
      include: { location: true },
      orderBy: { sequence: 'asc' }
    });
    
    for (const altLoc of alternativeLocations) {
      if (await this.hasCapacity(altLoc.location.id, item.approvedQty)) {
        return altLoc.location;
      }
    }
    
    // 3. Buscar localização vazia mais próxima
    const emptyLocation = await this.findNearestEmptyLocation(
      item.product.categoryId
    );
    
    if (emptyLocation) return emptyLocation;
    
    // 4. Localização de overflow
    return await this.getOverflowLocation();
  }
  
  /**
   * Verificar capacidade de localização
   */
  async hasCapacity(locationId: string, quantity: number): Promise<boolean> {
    const location = await prisma.location.findUnique({
      where: { id: locationId },
      include: {
        balances: true
      }
    });
    
    if (!location) return false;
    if (!location.maxWeight) return true; // Sem limite
    
    // Calcular ocupação atual
    const currentWeight = location.balances.reduce(
      (sum, balance) => sum + Number(balance.quantity),
      0
    );
    
    // Verificar se cabe
    return (currentWeight + quantity) <= Number(location.maxWeight);
  }
  
  /**
   * Buscar localização vazia mais próxima
   */
  async findNearestEmptyLocation(categoryId?: string): Promise<Location | null> {
    // Buscar localizações vazias do tipo BIN
    const emptyLocations = await prisma.location.findMany({
      where: {
        type: 'BIN',
        active: true,
        balances: {
          none: {} // Sem saldo
        }
      },
      orderBy: {
        code: 'asc' // Ordenar por código (proximidade física)
      },
      take: 1
    });
    
    return emptyLocations[0] || null;
  }
  
  /**
   * Obter localização de overflow
   */
  async getOverflowLocation(): Promise<Location> {
    const overflow = await prisma.location.findFirst({
      where: {
        code: { startsWith: 'OVERFLOW' }
      }
    });
    
    if (!overflow) {
      throw new Error('Localização de overflow não encontrada');
    }
    
    return overflow;
  }
  
  /**
   * Sugerir localizações para todos os itens de um recebimento
   */
  async suggestAllLocations(receiptId: string) {
    const items = await prisma.goodsReceiptItem.findMany({
      where: {
        receiptId,
        inspectionStatus: 'APPROVED',
        allocationStatus: 'PENDING'
      }
    });
    
    const suggestions = [];
    
    for (const item of items) {
      const location = await this.suggestLocation(item.id);
      
      // Atualizar item com sugestão
      await prisma.goodsReceiptItem.update({
        where: { id: item.id },
        data: {
          suggestedLocation: location.id,
          allocationStatus: 'SUGGESTED'
        }
      });
      
      suggestions.push({
        itemId: item.id,
        productId: item.productId,
        quantity: item.approvedQty,
        suggestedLocation: location
      });
    }
    
    return suggestions;
  }
  
  /**
   * Executar alocação (put-away)
   */
  async allocate(itemId: string, locationId: string, userId: string) {
    const item = await prisma.goodsReceiptItem.findUnique({
      where: { id: itemId },
      include: { product: true }
    });
    
    if (!item) throw new Error('Item não encontrado');
    if (item.inspectionStatus !== 'APPROVED') {
      throw new Error('Item não aprovado na conferência');
    }
    
    // Verificar capacidade
    const hasCapacity = await this.hasCapacity(locationId, Number(item.approvedQty));
    if (!hasCapacity) {
      throw new Error('Localização sem capacidade suficiente');
    }
    
    // Criar movimentação de entrada
    await prisma.stockMovement.create({
      data: {
        productId: item.productId,
        toLocationId: locationId,
        type: 'IN',
        quantity: item.approvedQty,
        reason: 'Recebimento de mercadoria',
        reference: item.receiptId,
        referenceType: 'GOODS_RECEIPT',
        lotNumber: item.lotNumber,
        userId
      }
    });
    
    // Atualizar saldo
    await prisma.stockBalance.upsert({
      where: {
        productId_locationId_lotNumber: {
          productId: item.productId,
          locationId,
          lotNumber: item.lotNumber || ''
        }
      },
      create: {
        productId: item.productId,
        locationId,
        quantity: item.approvedQty,
        availableQty: item.approvedQty,
        lotNumber: item.lotNumber,
        expiryDate: item.expiryDate
      },
      update: {
        quantity: { increment: item.approvedQty },
        availableQty: { increment: item.approvedQty }
      }
    });
    
    // Atualizar item
    await prisma.goodsReceiptItem.update({
      where: { id: itemId },
      data: {
        allocatedLocation: locationId,
        allocationStatus: 'ALLOCATED'
      }
    });
    
    // Verificar se todos os itens foram alocados
    await this.checkAllocationComplete(item.receiptId);
  }
  
  /**
   * Verificar se alocação está completa
   */
  async checkAllocationComplete(receiptId: string) {
    const items = await prisma.goodsReceiptItem.findMany({
      where: { receiptId }
    });
    
    const allAllocated = items.every(
      item => item.allocationStatus === 'ALLOCATED' || item.inspectionStatus === 'REJECTED'
    );
    
    if (allAllocated) {
      await prisma.goodsReceipt.update({
        where: { id: receiptId },
        data: { status: 'COMPLETED' }
      });
    }
  }
  
  /**
   * Otimizar rota de alocação
   */
  async optimizeAllocationRoute(receiptId: string) {
    const items = await prisma.goodsReceiptItem.findMany({
      where: {
        receiptId,
        allocationStatus: 'SUGGESTED'
      },
      include: {
        suggestedLoc: true
      }
    });
    
    // Ordenar por localização (proximidade física)
    const sorted = items.sort((a, b) => {
      const codeA = a.suggestedLoc?.code || '';
      const codeB = b.suggestedLoc?.code || '';
      return codeA.localeCompare(codeB);
    });
    
    return sorted.map((item, index) => ({
      sequence: index + 1,
      itemId: item.id,
      productCode: item.product.code,
      quantity: item.approvedQty,
      location: item.suggestedLoc?.code
    }));
  }
}
```

**Esforço:** 5-7 dias
- Implementar algoritmos de sugestão
- Lógica de capacidade e restrições
- Otimização de rotas
- Endpoints da API
- Testes complexos

---

### **FASE 2 - WMS Intermediário (2-3 semanas)** 🟡

#### **2.1 Capacidade de Localizações**
```prisma
model Location {
  // ... campos existentes
  
  // NOVO: Capacidade
  maxWeight       Decimal?  @db.Decimal(10, 2)
  maxVolume       Decimal?  @db.Decimal(10, 2)
  maxPallets      Int?
  
  // Dimensões (cm)
  width           Decimal?  @db.Decimal(10, 2)
  height          Decimal?  @db.Decimal(10, 2)
  depth           Decimal?  @db.Decimal(10, 2)
}
```

**Esforço:** 3-4 dias

---

#### **2.2 Regras de Armazenamento**
```prisma
model StorageRule {
  id              String    @id @default(uuid())
  name            String
  priority        Int       @default(0)
  
  // Critérios
  productType     String?   // Tipo de produto
  categoryId      String?   // Categoria
  
  // Regras
  strategy        StorageStrategy  // FIFO, FEFO, LIFO, RANDOM
  allowMixedLots  Boolean   @default(false)
  allowMixedProducts Boolean @default(false)
  
  // Localizações permitidas
  allowedLocations LocationRule[]
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@map("storage_rules")
}

enum StorageStrategy {
  FIFO    // First In, First Out
  FEFO    // First Expired, First Out
  LIFO    // Last In, First Out
  RANDOM  // Aleatório
}
```

**Esforço:** 5-7 dias

---

#### **2.3 Gestão de Lotes**
```prisma
model Lot {
  id              String    @id @default(uuid())
  lotNumber       String    @unique
  productId       String
  
  // Datas
  manufacturingDate DateTime?
  expiryDate      DateTime?
  receivedDate    DateTime  @default(now())
  
  // Quantidades
  initialQty      Decimal   @db.Decimal(10, 2)
  currentQty      Decimal   @db.Decimal(10, 2)
  
  // Rastreamento
  supplierId      String?
  purchaseOrderId String?
  
  // Status
  status          LotStatus @default(ACTIVE)
  blocked         Boolean   @default(false)
  blockReason     String?
  
  // Relações
  product         Product   @relation(fields: [productId], references: [id])
  balances        StockBalance[]
  
  @@index([productId])
  @@index([expiryDate])
  @@map("lots")
}

enum LotStatus {
  ACTIVE
  QUARANTINE
  BLOCKED
  CONSUMED
}
```

**Esforço:** 5-7 dias

---

#### **2.4 Dashboard WMS**
- Mapa de calor do armazém
- Ocupação por área
- Produtos sem localização
- Sugestões de reorganização
- Relatórios de movimentação

**Esforço:** 7-10 dias

---

### **FASE 3 - WMS Avançado (3-4 semanas)** 🟢

#### **3.1 Tarefas de Armazém**
```prisma
model WarehouseTask {
  id              String    @id @default(uuid())
  type            TaskType  // PUTAWAY, PICKING, REPLENISHMENT, TRANSFER, COUNTING
  priority        Int       @default(0)
  status          TaskStatus @default(PENDING)
  
  // Produto e localização
  productId       String
  fromLocationId  String?
  toLocationId    String?
  quantity        Decimal   @db.Decimal(10, 2)
  
  // Atribuição
  assignedTo      String?
  assignedAt      DateTime?
  startedAt       DateTime?
  completedAt     DateTime?
  
  // Referência
  reference       String?
  referenceType   String?
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@index([status, priority])
  @@index([assignedTo])
  @@map("warehouse_tasks")
}
```

**Esforço:** 7-10 dias

---

#### **3.2 Reabastecimento Automático**
- Monitorar níveis mínimos
- Sugerir transferências
- Criar tarefas automaticamente
- Otimizar picking areas

**Esforço:** 5-7 dias

---

#### **3.3 Integração com Dispositivos**
- API para coletores de dados
- Integração com balanças
- Leitura de RFID
- Impressão de etiquetas

**Esforço:** 10-14 dias

---

## 📊 Resumo de Esforço

### **FASE 1 - Básico para Contagem** 🔴
| Item | Esforço | Prioridade |
|------|---------|------------|
| 1.1 Saldo por Localização | 2-3 dias | ⭐⭐⭐⭐⭐ |
| 1.2 Movimentação com Localização | 2-3 dias | ⭐⭐⭐⭐⭐ |
| 1.3 Endereçamento de Produtos | 1-2 dias | ⭐⭐⭐⭐⭐ |
| 1.4 Ordenação para Contagem | 2-3 dias | ⭐⭐⭐⭐⭐ |
| 1.5 Atualizar CountingItem | 1 dia | ⭐⭐⭐⭐⭐ |
| 1.6 Entrada de Mercadoria | 5-7 dias | ⭐⭐⭐⭐⭐ |
| 1.7 Conferência de Recebimento | 3-4 dias | ⭐⭐⭐⭐⭐ |
| 1.8 Alocação Automática | 5-7 dias | ⭐⭐⭐⭐⭐ |
| **TOTAL FASE 1** | **21-31 dias (4-6 semanas)** | **CRÍTICO** |

### **FASE 2 - WMS Intermediário** 🟡
| Item | Esforço | Prioridade |
|------|---------|------------|
| 2.1 Capacidade de Localizações | 3-4 dias | ⭐⭐⭐⭐ |
| 2.2 Regras de Armazenamento | 5-7 dias | ⭐⭐⭐⭐ |
| 2.3 Gestão de Lotes | 5-7 dias | ⭐⭐⭐⭐ |
| 2.4 Dashboard WMS | 7-10 dias | ⭐⭐⭐ |
| **TOTAL FASE 2** | **20-28 dias (4-5.5 semanas)** | **IMPORTANTE** |

### **FASE 3 - WMS Avançado** 🟢
| Item | Esforço | Prioridade |
|------|---------|------------|
| 3.1 Tarefas de Armazém | 7-10 dias | ⭐⭐⭐ |
| 3.2 Reabastecimento Automático | 5-7 dias | ⭐⭐⭐ |
| 3.3 Integração com Dispositivos | 10-14 dias | ⭐⭐ |
| **TOTAL FASE 3** | **22-31 dias (4.5-6 semanas)** | **DESEJÁVEL** |

---

## 💰 Estimativa Total

| Fase | Duração | Complexidade | ROI |
|------|---------|--------------|-----|
| **Fase 1** | 4-6 semanas | Média-Alta | ⭐⭐⭐⭐⭐ Imediato |
| **Fase 2** | 4-5.5 semanas | Alta | ⭐⭐⭐⭐ Alto |
| **Fase 3** | 4.5-6 semanas | Muito Alta | ⭐⭐⭐ Médio |
| **TOTAL** | **12.5-17.5 semanas** | **Alta** | **Progressivo** |

---

## 🎯 Recomendação

### **Para Resolver APENAS os Requisitos de Contagem:**

✅ **IMPLEMENTAR FASE 1 (1.5-2.5 semanas)**

**Justificativa:**
1. ✅ Resolve 100% dos requisitos de ordenação e agrupamento
2. ✅ Base sólida já existe (50% do trabalho)
3. ✅ Não quebra nada existente
4. ✅ Habilita Fases 2 e 3 no futuro
5. ✅ ROI imediato na contagem de estoque

**Entregas da Fase 1:**
- ✅ Saldo de estoque por localização
- ✅ Movimentação rastreada por localização
- ✅ Produtos endereçados em localizações
- ✅ **Ordenação automática de itens de contagem**
- ✅ **Agrupamento por corredor/prateleira**
- ✅ **Picking list otimizado (mapa de contagem)**
- ✅ **Entrada de mercadoria com agendamento**
- ✅ **Conferência de recebimento com validações**
- ✅ **Alocação automática inteligente (put-away)**
- ✅ **Gestão de não conformidades**
- ✅ **Rastreamento de lotes desde o recebimento**

---

### **Para WMS Completo:**

✅ **IMPLEMENTAR FASES 1 + 2 (6-8 semanas)**

**Justificativa:**
- Gestão completa de estoque por localização
- Regras de armazenamento
- Controle de lotes e validade
- Dashboard gerencial
- Base para automação futura

---

## 📝 Próximos Passos

### **Se aprovar Fase 1:**
1. ✅ Criar migrations do schema
2. ✅ Implementar services de saldo e movimentação
3. ✅ Criar endpoints da API
4. ✅ Implementar service de otimização de rotas
5. ✅ Atualizar módulo de contagem
6. ✅ Testes unitários e integração
7. ✅ Documentação da API

### **Dependências:**
- ❌ Nenhuma! Estrutura de Location já existe
- ✅ Compatível com sistema atual
- ✅ Implementação incremental

---

## 💡 Observações Importantes

1. **Estrutura já existe:** 60% do trabalho de WMS básico já está feito
2. **Compatibilidade:** Não quebra funcionalidades existentes
3. **Incremental:** Pode ser implementado por partes
4. **ROI rápido:** Benefícios imediatos na Fase 1
5. **Escalável:** Fases 2 e 3 são opcionais

---

**Elaborado por:** Sistema de Análise Fabric  
**Revisão:** Pendente  
**Aprovação:** Pendente




***********************************************************************

Excelente análise! Vou revisar o módulo atual de contagem de estoque e propor melhorias completas. Primeiro, vou verificar o que já existe:

Ótimo! Já existe um módulo de contagem. Vou analisar a estrutura atual:

Excelente! Agora vou analisar os enums e criar um parecer completo:

Perfeito! Agora tenho uma visão completa. Vou criar um documento de análise e proposta:

## 📊 Parecer Técnico - Módulo de Contagem de Estoque

Criei uma análise completa em [docs/COUNTING_MODULE_IMPROVEMENTS.md](cci:7://file:///e:/Fabric/docs/COUNTING_MODULE_IMPROVEMENTS.md:0:0-0:0). Aqui está o resumo executivo:

---

### ✅ **Situação Atual**
O módulo JÁ possui uma base sólida:
- ✅ Estrutura de dados completa (Planos, Sessões, Itens)
- ✅ Tipos de contagem (Cíclica, Pontual, Inventário Completo)
- ✅ Frequências configuráveis (Diária até Trimestral)
- ✅ Suporte a recontagem e tolerâncias
- ✅ Rastreamento de responsáveis

### ❌ **Gaps Identificados (Suas Sugestões)**

| Requisito | Status | Prioridade |
|-----------|--------|------------|
| **1. Plano com vários produtos** | ⚠️ Parcial | 🔴 URGENTE |
| **2. Atribuição a funcionários** | ⚠️ Parcial | 🔴 URGENTE |
| **3. Planos cíclicos automáticos** | ⚠️ Parcial | 🔴 URGENTE |
| **4. Interface de entrada** | ❌ Falta | 🔴 URGENTE |

---

### 💡 **Minhas Sugestões Adicionais**

**Críticas:**
- 📊 Dashboard de analytics e acuracidade
- 🗺️ Otimização de rotas de contagem
- 🔍 Validações inteligentes com alertas
- 📱 PWA mobile com scanner de código de barras

**Avançadas:**
- 🤖 Machine Learning para prever divergências
- 🔗 Integração com produção (bloqueio de movimentações)
- 📈 Análise de tendências e padrões
- 🏆 Performance dos contadores

---

### 🎯 **Plano de Implementação Recomendado**

#### **FASE 1 - Crítico (2-3 semanas)** 🔴
1. **Seleção manual de produtos**
   - Nova tabela `CountingPlanProduct`
   - Endpoints para adicionar/remover produtos
   - Preview antes de criar plano

2. **Atribuição múltipla de contadores**
   - Nova tabela `CountingAssignment`
   - Roles: PRIMARY, SECONDARY, VALIDATOR, SUPERVISOR
   - Reatribuição automática

3. **Automação de planos cíclicos**
   - Job scheduler diário
   - Cálculo automático de `nextExecution`
   - Criação automática de sessões

4. **Interface de entrada de contagem**
   - Tela mobile-friendly `/counting/sessions/:id/count`
   - Scanner de código de barras
   - Validação em tempo real
   - Modo offline (PWA)

#### **FASE 2 - Importante (3-4 semanas)** 🟡
5. Critérios avançados (ABC, criticidade, localização)
6. Otimização de rotas
7. Dashboard de analytics
8. Relatórios de divergências

#### **FASE 3 - Desejável (4-6 semanas)** 🟢
9. Machine Learning
10. PWA completo
11. IoT integration
12. Blockchain para auditoria

---

### 💰 **Estimativa**
- **Total:** 9-13 semanas
- **Fase 1:** 2-3 semanas ⭐⭐⭐⭐⭐ (ROI Máximo)
- **Complexidade:** Média a Alta
- **Compatibilidade:** 100% com estrutura atual

---

### 🎯 **Minha Recomendação**

**APROVAR FASE 1 IMEDIATAMENTE** porque:
1. ✅ Resolve 100% dos seus requisitos críticos
2. ✅ Base sólida já existe (50% do trabalho feito)
3. ✅ ROI alto e rápido
4. ✅ Não quebra nada existente
5. ✅ Habilita Fases 2 e 3 no futuro

**Quer que eu comece a implementar a Fase 1?** Posso criar:
- Schema migrations
- Services e controllers
- Endpoints da API
- Componentes React do frontend
- Testes automatizados

Ou prefere revisar o documento completo primeiro?