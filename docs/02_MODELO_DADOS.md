# 🗄 Fabric - Modelo de Dados

## 📋 Visão Geral

Modelo de dados completo do sistema Fabric usando Prisma ORM, seguindo os mesmos padrões do VagaLume.

## 🏗 Estrutura do Schema

### **Organização por Domínio**

1. **Segurança** - Usuários, perfis e permissões
2. **Cadastros** - Master data básico
3. **Engenharia** - Produtos, BOMs e roteiros
4. **Planejamento** - MRP e sugestões
5. **Estoque** - Almoxarifados e movimentações
6. **Produção** - Ordens e apontamentos
7. **Compras** - Pedidos e recebimentos
8. **Manutenção** - Equipamentos e ordens de serviço
9. **Qualidade** - Inspeções e não-conformidades

## 📝 Schema Prisma Completo

### **1. Segurança e Usuários**

```prisma
model User {
  id            String    @id @default(uuid())
  email         String    @unique
  password      String    // Hash bcrypt
  name          String
  active        Boolean   @default(true)
  lastLogin     DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  roles         UserRole[]
  auditLogs     AuditLog[]
  productionPointings ProductionPointing[]
  
  @@map("users")
}

model Role {
  id            String    @id @default(uuid())
  code          String    @unique
  name          String
  description   String?
  active        Boolean   @default(true)
  
  users         UserRole[]
  permissions   RolePermission[]
  
  @@map("roles")
}

model Permission {
  id            String    @id @default(uuid())
  resource      String    // Ex: "production_order"
  action        String    // Ex: "create", "read", "update", "delete"
  description   String?
  
  roles         RolePermission[]
  
  @@unique([resource, action])
  @@map("permissions")
}

model UserRole {
  userId        String
  roleId        String
  assignedAt    DateTime  @default(now())
  
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  role          Role      @relation(fields: [roleId], references: [id], onDelete: Cascade)
  
  @@id([userId, roleId])
  @@map("user_roles")
}

model RolePermission {
  roleId        String
  permissionId  String
  
  role          Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission    Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)
  
  @@id([roleId, permissionId])
  @@map("role_permissions")
}

model AuditLog {
  id            String    @id @default(uuid())
  userId        String
  action        String    // "CREATE", "UPDATE", "DELETE", "LOGIN", etc.
  resource      String    // Nome da tabela/recurso
  resourceId    String?   // ID do registro afetado
  oldValues     Json?     // Valores anteriores
  newValues     Json?     // Novos valores
  ipAddress     String?
  userAgent     String?
  createdAt     DateTime  @default(now())
  
  user          User      @relation(fields: [userId], references: [id])
  
  @@index([userId])
  @@index([resource, resourceId])
  @@index([createdAt])
  @@map("audit_logs")
}
```

### **2. Cadastros Básicos**

```prisma
model WorkCenter {
  id            String    @id @default(uuid())
  code          String    @unique
  name          String
  description   String?
  type          String    // "MACHINE", "SECTOR", "CELL", "ASSEMBLY_LINE"
  capacity      Float?    // Capacidade em horas/dia
  efficiency    Float     @default(1.0) // Fator de eficiência (0-1)
  costPerHour   Float?    // Custo por hora
  active        Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  operations    RoutingOperation[]
  productionOperations ProductionOrderOperation[]
  maintenanceOrders MaintenanceOrder[]
  equipment     Equipment[]
  
  @@map("work_centers")
}

model UnitOfMeasure {
  id            String    @id @default(uuid())
  code          String    @unique
  name          String
  type          String    // "WEIGHT", "LENGTH", "VOLUME", "UNIT", "TIME"
  symbol        String?   // "kg", "m", "l", "un"
  
  products      Product[]
  bomItems      BOMItem[]
  
  @@map("units_of_measure")
}

model Supplier {
  id            String    @id @default(uuid())
  code          String    @unique
  name          String
  legalName     String?
  document      String?   // CNPJ
  email         String?
  phone         String?
  address       String?
  city          String?
  state         String?
  zipCode       String?
  country       String    @default("BR")
  paymentTerms  String?
  leadTime      Int?      // Dias
  rating        Float?    // Avaliação (0-5)
  active        Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  purchaseOrders PurchaseOrder[]
  evaluations   SupplierEvaluation[]
  
  @@map("suppliers")
}

model Customer {
  id            String    @id @default(uuid())
  code          String    @unique
  name          String
  legalName     String?
  document      String?   // CNPJ/CPF
  email         String?
  phone         String?
  address       String?
  city          String?
  state         String?
  zipCode       String?
  country       String    @default("BR")
  paymentTerms  String?
  creditLimit   Float?
  active        Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  salesOrders   SalesOrder[]
  
  @@map("customers")
}

model Shift {
  id            String    @id @default(uuid())
  code          String    @unique
  name          String
  startTime     String    // "08:00"
  endTime       String    // "17:00"
  breakTime     Int       @default(0) // Minutos
  workingHours  Float     // Horas úteis
  active        Boolean   @default(true)
  
  @@map("shifts")
}

model Calendar {
  id            String    @id @default(uuid())
  date          DateTime  @unique @db.Date
  isWorkingDay  Boolean   @default(true)
  description   String?   // Ex: "Feriado Nacional - Natal"
  type          String?   // "HOLIDAY", "WEEKEND", "SPECIAL"
  
  @@index([date])
  @@map("calendar")
}
```

### **3. Engenharia de Produtos**

```prisma
model Product {
  id            String    @id @default(uuid())
  code          String    @unique
  name          String
  description   String?   @db.Text
  type          String    // "FINISHED", "SEMI_FINISHED", "RAW_MATERIAL", "PACKAGING"
  unitId        String
  categoryId    String?
  
  // Planejamento
  leadTime      Int       @default(0) // Dias
  lotSize       Float?    // Tamanho do lote padrão
  
  // Estoque
  minStock      Float     @default(0)
  maxStock      Float?
  safetyStock   Float     @default(0)
  reorderPoint  Float?
  
  // Custos
  standardCost  Float?
  lastCost      Float?
  averageCost   Float?
  
  // Status
  active        Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  unit          UnitOfMeasure @relation(fields: [unitId], references: [id])
  category      ProductCategory? @relation(fields: [categoryId], references: [id])
  
  boms          BOM[]
  bomItems      BOMItem[]
  routings      Routing[]
  stock         Stock[]
  productionOrders ProductionOrder[]
  salesOrderItems SalesOrderItem[]
  
  @@index([type])
  @@index([active])
  @@map("products")
}

model ProductCategory {
  id            String    @id @default(uuid())
  code          String    @unique
  name          String
  description   String?
  parentId      String?   // Para hierarquia
  
  parent        ProductCategory? @relation("CategoryHierarchy", fields: [parentId], references: [id])
  children      ProductCategory[] @relation("CategoryHierarchy")
  products      Product[]
  
  @@map("product_categories")
}

model BOM {
  id            String    @id @default(uuid())
  productId     String
  version       Int       @default(1)
  description   String?
  validFrom     DateTime  @default(now())
  validTo       DateTime?
  active        Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  product       Product   @relation(fields: [productId], references: [id])
  items         BOMItem[]
  
  @@unique([productId, version])
  @@index([productId, active])
  @@map("boms")
}

model BOMItem {
  id            String    @id @default(uuid())
  bomId         String
  componentId   String
  quantity      Float
  unitId        String
  scrapFactor   Float     @default(0) // % de perda (0-100)
  sequence      Int
  notes         String?
  
  bom           BOM       @relation(fields: [bomId], references: [id], onDelete: Cascade)
  component     Product   @relation(fields: [componentId], references: [id])
  unit          UnitOfMeasure @relation(fields: [unitId], references: [id])
  
  @@index([bomId])
  @@map("bom_items")
}

model Routing {
  id            String    @id @default(uuid())
  productId     String
  version       Int       @default(1)
  description   String?
  validFrom     DateTime  @default(now())
  validTo       DateTime?
  active        Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  product       Product   @relation(fields: [productId], references: [id])
  operations    RoutingOperation[]
  
  @@unique([productId, version])
  @@index([productId, active])
  @@map("routings")
}

model RoutingOperation {
  id            String    @id @default(uuid())
  routingId     String
  sequence      Int
  workCenterId  String
  description   String
  setupTime     Float     // Minutos
  runTime       Float     // Minutos por unidade
  queueTime     Float     @default(0) // Tempo de fila
  moveTime      Float     @default(0) // Tempo de movimentação
  notes         String?
  
  routing       Routing   @relation(fields: [routingId], references: [id], onDelete: Cascade)
  workCenter    WorkCenter @relation(fields: [workCenterId], references: [id])
  
  @@index([routingId])
  @@map("routing_operations")
}
```

### **4. MRP e Planejamento**

```prisma
model MRPRun {
  id            String    @id @default(uuid())
  runNumber     String    @unique
  runDate       DateTime  @default(now())
  planningHorizon Int     // Dias
  status        String    @default("RUNNING") // "RUNNING", "COMPLETED", "ERROR"
  startedAt     DateTime  @default(now())
  completedAt   DateTime?
  errorMessage  String?   @db.Text
  
  requirements  MRPRequirement[]
  purchaseSuggestions PurchaseSuggestion[]
  productionSuggestions ProductionSuggestion[]
  
  @@index([status])
  @@index([runDate])
  @@map("mrp_runs")
}

model MRPRequirement {
  id            String    @id @default(uuid())
  mrpRunId      String
  productId     String
  requirementDate DateTime @db.Date
  grossRequirement Float
  scheduledReceipts Float  @default(0)
  projectedStock Float
  netRequirement Float
  plannedOrder  Float
  level         Int       // Nível na explosão de BOM
  
  mrpRun        MRPRun    @relation(fields: [mrpRunId], references: [id], onDelete: Cascade)
  
  @@index([mrpRunId, productId])
  @@index([requirementDate])
  @@map("mrp_requirements")
}

model PurchaseSuggestion {
  id            String    @id @default(uuid())
  mrpRunId      String
  productId     String
  quantity      Float
  requiredDate  DateTime  @db.Date
  suggestedOrderDate DateTime @db.Date
  status        String    @default("PENDING") // "PENDING", "CONVERTED", "CANCELLED"
  purchaseOrderId String?
  notes         String?
  createdAt     DateTime  @default(now())
  
  mrpRun        MRPRun    @relation(fields: [mrpRunId], references: [id], onDelete: Cascade)
  
  @@index([status])
  @@index([requiredDate])
  @@map("purchase_suggestions")
}

model ProductionSuggestion {
  id            String    @id @default(uuid())
  mrpRunId      String
  productId     String
  quantity      Float
  startDate     DateTime  @db.Date
  endDate       DateTime  @db.Date
  status        String    @default("PENDING") // "PENDING", "CONVERTED", "CANCELLED"
  productionOrderId String?
  notes         String?
  createdAt     DateTime  @default(now())
  
  mrpRun        MRPRun    @relation(fields: [mrpRunId], references: [id], onDelete: Cascade)
  
  @@index([status])
  @@index([startDate])
  @@map("production_suggestions")
}

model SalesOrder {
  id            String    @id @default(uuid())
  orderNumber   String    @unique
  customerId    String
  orderDate     DateTime  @default(now())
  deliveryDate  DateTime
  status        String    @default("PENDING") // "PENDING", "CONFIRMED", "IN_PRODUCTION", "DELIVERED", "CANCELLED"
  totalAmount   Float?
  notes         String?   @db.Text
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  customer      Customer  @relation(fields: [customerId], references: [id])
  items         SalesOrderItem[]
  
  @@index([status])
  @@index([deliveryDate])
  @@map("sales_orders")
}

model SalesOrderItem {
  id            String    @id @default(uuid())
  salesOrderId  String
  productId     String
  quantity      Float
  unitPrice     Float
  totalPrice    Float
  deliveryDate  DateTime
  
  salesOrder    SalesOrder @relation(fields: [salesOrderId], references: [id], onDelete: Cascade)
  product       Product   @relation(fields: [productId], references: [id])
  
  @@index([salesOrderId])
  @@map("sales_order_items")
}
```

Continua no próximo arquivo...
