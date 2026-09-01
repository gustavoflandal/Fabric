# 🗄 Fabric - Modelo de Dados (Parte 2)

## 5. Estoque e Almoxarifado

```prisma
model Warehouse {
  id            String    @id @default(uuid())
  code          String    @unique
  name          String
  description   String?
  type          String    // "MAIN", "PRODUCTION", "FINISHED_GOODS", "QUARANTINE"
  address       String?
  active        Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  locations     Location[]
  stock         Stock[]
  inventories   Inventory[]
  
  @@map("warehouses")
}

model Location {
  id            String    @id @default(uuid())
  warehouseId   String
  code          String
  name          String
  type          String?   // "RACK", "SHELF", "FLOOR", "PALLET"
  capacity      Float?
  
  warehouse     Warehouse @relation(fields: [warehouseId], references: [id], onDelete: Cascade)
  stock         Stock[]
  
  @@unique([warehouseId, code])
  @@index([warehouseId])
  @@map("locations")
}

model Stock {
  id            String    @id @default(uuid())
  productId     String
  warehouseId   String
  locationId    String?
  lotId         String?
  quantity      Float
  reservedQty   Float     @default(0)
  availableQty  Float     // Calculado: quantity - reservedQty
  lastMovement  DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  product       Product   @relation(fields: [productId], references: [id])
  warehouse     Warehouse @relation(fields: [warehouseId], references: [id])
  location      Location? @relation(fields: [locationId], references: [id])
  lot           Lot?      @relation(fields: [lotId], references: [id])
  
  @@unique([productId, warehouseId, locationId, lotId])
  @@index([productId])
  @@index([warehouseId])
  @@map("stock")
}

model StockMovement {
  id            String    @id @default(uuid())
  movementNumber String   @unique
  productId     String
  warehouseId   String
  locationId    String?
  lotId         String?
  movementType  String    // "IN", "OUT", "TRANSFER", "ADJUSTMENT"
  quantity      Float
  unitCost      Float?
  totalCost     Float?
  referenceType String?   // "PURCHASE", "PRODUCTION", "SALES", "ADJUSTMENT", "TRANSFER"
  referenceId   String?
  notes         String?   @db.Text
  createdAt     DateTime  @default(now())
  createdBy     String
  
  @@index([productId])
  @@index([warehouseId])
  @@index([movementType])
  @@index([createdAt])
  @@index([referenceType, referenceId])
  @@map("stock_movements")
}

model Lot {
  id            String    @id @default(uuid())
  lotNumber     String    @unique
  productId     String
  supplierId    String?
  manufacturingDate DateTime?
  expirationDate DateTime?
  receiptDate   DateTime  @default(now())
  initialQty    Float
  currentQty    Float
  status        String    @default("ACTIVE") // "ACTIVE", "BLOCKED", "QUARANTINE", "EXPIRED"
  notes         String?   @db.Text
  createdAt     DateTime  @default(now())
  
  stock         Stock[]
  
  @@index([lotNumber])
  @@index([productId])
  @@index([status])
  @@map("lots")
}

model Inventory {
  id            String    @id @default(uuid())
  inventoryNumber String  @unique
  warehouseId   String
  type          String    // "CYCLE", "FULL", "SPOT"
  status        String    @default("PLANNED") // "PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"
  scheduledDate DateTime
  startedAt     DateTime?
  completedAt   DateTime?
  notes         String?   @db.Text
  createdBy     String
  
  warehouse     Warehouse @relation(fields: [warehouseId], references: [id])
  counts        InventoryCount[]
  
  @@index([status])
  @@index([scheduledDate])
  @@map("inventories")
}

model InventoryCount {
  id            String    @id @default(uuid())
  inventoryId   String
  productId     String
  locationId    String?
  lotId         String?
  systemQty     Float
  countedQty    Float
  difference    Float
  differenceValue Float?
  adjusted      Boolean   @default(false)
  adjustmentId  String?   // Referência ao movimento de ajuste
  notes         String?
  countedAt     DateTime  @default(now())
  countedBy     String
  
  inventory     Inventory @relation(fields: [inventoryId], references: [id], onDelete: Cascade)
  
  @@index([inventoryId])
  @@index([productId])
  @@map("inventory_counts")
}

model StockReservation {
  id            String    @id @default(uuid())
  productId     String
  warehouseId   String
  locationId    String?
  lotId         String?
  quantity      Float
  referenceType String    // "PRODUCTION_ORDER", "SALES_ORDER"
  referenceId   String
  status        String    @default("ACTIVE") // "ACTIVE", "CONSUMED", "CANCELLED"
  createdAt     DateTime  @default(now())
  expiresAt     DateTime?
  
  @@index([productId])
  @@index([referenceType, referenceId])
  @@index([status])
  @@map("stock_reservations")
}
```

## 6. Produção

```prisma
model MasterProductionSchedule {
  id            String    @id @default(uuid())
  productId     String
  period        DateTime  @db.Date // Início do período (semana/mês)
  periodType    String    // "WEEKLY", "MONTHLY"
  plannedQty    Float
  confirmedQty  Float     @default(0)
  producedQty   Float     @default(0)
  status        String    @default("PLANNED") // "PLANNED", "CONFIRMED", "RELEASED", "COMPLETED"
  notes         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  @@index([period])
  @@index([status])
  @@map("master_production_schedule")
}

model ProductionOrder {
  id            String    @id @default(uuid())
  orderNumber   String    @unique
  productId     String
  bomId         String?
  routingId     String?
  quantity      Float
  producedQty   Float     @default(0)
  scrapQty      Float     @default(0)
  priority      Int       @default(5) // 1-10 (1=mais alta)
  status        String    @default("PLANNED") // "PLANNED", "RELEASED", "IN_PROGRESS", "COMPLETED", "CANCELLED"
  
  // Datas
  scheduledStart DateTime
  scheduledEnd  DateTime
  actualStart   DateTime?
  actualEnd     DateTime?
  
  // Custos
  plannedCost   Float?
  actualCost    Float?
  
  // Referências
  salesOrderId  String?
  parentOrderId String?   // Para ordens de componentes
  
  notes         String?   @db.Text
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  createdBy     String
  
  product       Product   @relation(fields: [productId], references: [id])
  operations    ProductionOrderOperation[]
  pointings     ProductionPointing[]
  materialConsumptions MaterialConsumption[]
  losses        ProductionLoss[]
  
  @@index([status])
  @@index([scheduledStart])
  @@index([productId])
  @@map("production_orders")
}

model ProductionOrderOperation {
  id            String    @id @default(uuid())
  productionOrderId String
  sequence      Int
  workCenterId  String
  description   String
  
  // Quantidades
  plannedQty    Float
  completedQty  Float     @default(0)
  scrapQty      Float     @default(0)
  
  // Tempos (minutos)
  setupTime     Float
  runTime       Float     // Por unidade
  totalPlannedTime Float  // setup + (run * qty)
  actualTime    Float     @default(0)
  
  // Status e datas
  status        String    @default("PENDING") // "PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"
  scheduledStart DateTime?
  scheduledEnd  DateTime?
  actualStart   DateTime?
  actualEnd     DateTime?
  
  productionOrder ProductionOrder @relation(fields: [productionOrderId], references: [id], onDelete: Cascade)
  workCenter    WorkCenter @relation(fields: [workCenterId], references: [id])
  pointings     ProductionPointing[]
  
  @@index([productionOrderId])
  @@index([workCenterId])
  @@index([status])
  @@map("production_order_operations")
}

model ProductionPointing {
  id            String    @id @default(uuid())
  productionOrderId String
  operationId   String
  userId        String
  
  // Quantidades
  quantityGood  Float
  quantityScrap Float     @default(0)
  
  // Tempos
  setupTime     Float     @default(0) // Minutos
  runTime       Float     // Minutos
  
  // Datas
  startTime     DateTime
  endTime       DateTime
  
  notes         String?
  createdAt     DateTime  @default(now())
  
  productionOrder ProductionOrder @relation(fields: [productionOrderId], references: [id])
  operation     ProductionOrderOperation @relation(fields: [operationId], references: [id])
  user          User      @relation(fields: [userId], references: [id])
  
  @@index([productionOrderId])
  @@index([operationId])
  @@index([userId])
  @@index([startTime])
  @@map("production_pointings")
}

model MaterialConsumption {
  id            String    @id @default(uuid())
  productionOrderId String
  productId     String
  warehouseId   String
  lotId         String?
  
  // Quantidades
  plannedQty    Float
  consumedQty   Float
  
  // Custos
  unitCost      Float?
  totalCost     Float?
  
  consumedAt    DateTime  @default(now())
  consumedBy    String
  
  productionOrder ProductionOrder @relation(fields: [productionOrderId], references: [id])
  
  @@index([productionOrderId])
  @@index([productId])
  @@map("material_consumptions")
}

model ProductionLoss {
  id            String    @id @default(uuid())
  productionOrderId String
  operationId   String?
  lossType      String    // "SCRAP", "REWORK", "SETUP_LOSS"
  lossReason    String?   // "MACHINE_FAILURE", "QUALITY_ISSUE", "OPERATOR_ERROR", etc.
  quantity      Float
  unitCost      Float?
  totalCost     Float?
  description   String?   @db.Text
  occurredAt    DateTime  @default(now())
  reportedBy    String
  
  productionOrder ProductionOrder @relation(fields: [productionOrderId], references: [id])
  
  @@index([productionOrderId])
  @@index([lossType])
  @@index([occurredAt])
  @@map("production_losses")
}
```

## 7. Compras

```prisma
model PurchaseRequisition {
  id            String    @id @default(uuid())
  requisitionNumber String @unique
  requestedBy   String
  department    String?
  priority      String    @default("NORMAL") // "LOW", "NORMAL", "HIGH", "URGENT"
  status        String    @default("PENDING") // "PENDING", "APPROVED", "REJECTED", "CONVERTED"
  requestDate   DateTime  @default(now())
  requiredDate  DateTime
  notes         String?   @db.Text
  
  items         PurchaseRequisitionItem[]
  
  @@index([status])
  @@index([requiredDate])
  @@map("purchase_requisitions")
}

model PurchaseRequisitionItem {
  id            String    @id @default(uuid())
  requisitionId String
  productId     String
  quantity      Float
  estimatedPrice Float?
  notes         String?
  
  requisition   PurchaseRequisition @relation(fields: [requisitionId], references: [id], onDelete: Cascade)
  
  @@index([requisitionId])
  @@map("purchase_requisition_items")
}

model PurchaseQuotation {
  id            String    @id @default(uuid())
  quotationNumber String  @unique
  supplierId    String
  quotationDate DateTime  @default(now())
  validUntil    DateTime
  status        String    @default("PENDING") // "PENDING", "APPROVED", "REJECTED"
  totalAmount   Float?
  notes         String?   @db.Text
  
  items         PurchaseQuotationItem[]
  
  @@index([supplierId])
  @@index([status])
  @@map("purchase_quotations")
}

model PurchaseQuotationItem {
  id            String    @id @default(uuid())
  quotationId   String
  productId     String
  quantity      Float
  unitPrice     Float
  totalPrice    Float
  leadTime      Int?      // Dias
  notes         String?
  
  quotation     PurchaseQuotation @relation(fields: [quotationId], references: [id], onDelete: Cascade)
  
  @@index([quotationId])
  @@map("purchase_quotation_items")
}

model PurchaseOrder {
  id            String    @id @default(uuid())
  orderNumber   String    @unique
  supplierId    String
  orderDate     DateTime  @default(now())
  expectedDate  DateTime
  status        String    @default("PENDING") // "PENDING", "APPROVED", "SENT", "PARTIAL", "RECEIVED", "CANCELLED"
  paymentTerms  String?
  totalAmount   Float?
  notes         String?   @db.Text
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  createdBy     String
  
  supplier      Supplier  @relation(fields: [supplierId], references: [id])
  items         PurchaseOrderItem[]
  receipts      MaterialReceipt[]
  
  @@index([supplierId])
  @@index([status])
  @@index([expectedDate])
  @@map("purchase_orders")
}

model PurchaseOrderItem {
  id            String    @id @default(uuid())
  purchaseOrderId String
  productId     String
  quantity      Float
  receivedQty   Float     @default(0)
  unitPrice     Float
  totalPrice    Float
  notes         String?
  
  purchaseOrder PurchaseOrder @relation(fields: [purchaseOrderId], references: [id], onDelete: Cascade)
  
  @@index([purchaseOrderId])
  @@index([productId])
  @@map("purchase_order_items")
}

model MaterialReceipt {
  id            String    @id @default(uuid())
  receiptNumber String    @unique
  purchaseOrderId String
  warehouseId   String
  receiptDate   DateTime  @default(now())
  status        String    @default("PENDING") // "PENDING", "INSPECTED", "APPROVED", "REJECTED"
  notes         String?   @db.Text
  receivedBy    String
  
  purchaseOrder PurchaseOrder @relation(fields: [purchaseOrderId], references: [id])
  items         MaterialReceiptItem[]
  
  @@index([purchaseOrderId])
  @@index([receiptDate])
  @@map("material_receipts")
}

model MaterialReceiptItem {
  id            String    @id @default(uuid())
  receiptId     String
  productId     String
  quantityOrdered Float
  quantityReceived Float
  lotNumber     String?
  inspectionStatus String? // "PENDING", "APPROVED", "REJECTED"
  notes         String?
  
  receipt       MaterialReceipt @relation(fields: [receiptId], references: [id], onDelete: Cascade)
  
  @@index([receiptId])
  @@map("material_receipt_items")
}

model SupplierEvaluation {
  id            String    @id @default(uuid())
  supplierId    String
  evaluationDate DateTime @default(now())
  period        String    // "2024-Q1", "2024-01", etc.
  
  // Critérios (0-5)
  qualityScore  Float
  deliveryScore Float
  priceScore    Float
  serviceScore  Float
  overallScore  Float     // Média ponderada
  
  notes         String?   @db.Text
  evaluatedBy   String
  
  supplier      Supplier  @relation(fields: [supplierId], references: [id])
  
  @@index([supplierId])
  @@index([evaluationDate])
  @@map("supplier_evaluations")
}
```

Continua na Parte 3...
