# 🗄 Fabric - Modelo de Dados (Parte 3)

## 8. Manutenção de Ativos

```prisma
model Equipment {
  id            String    @id @default(uuid())
  code          String    @unique
  name          String
  description   String?
  type          String    // "MACHINE", "TOOL", "VEHICLE", "INFRASTRUCTURE"
  workCenterId  String?
  manufacturer  String?
  model         String?
  serialNumber  String?
  
  // Datas
  acquisitionDate DateTime?
  warrantyExpiration DateTime?
  
  // Valores
  acquisitionValue Float?
  currentValue  Float?
  
  // Status
  status        String    @default("ACTIVE") // "ACTIVE", "MAINTENANCE", "INACTIVE", "RETIRED"
  active        Boolean   @default(true)
  
  // Contadores
  hasCounter    Boolean   @default(false)
  counterType   String?   // "HOURS", "CYCLES", "KILOMETERS"
  currentCounter Float?
  
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  workCenter    WorkCenter? @relation(fields: [workCenterId], references: [id])
  maintenancePlans MaintenancePlan[]
  maintenanceOrders MaintenanceOrder[]
  counters      EquipmentCounter[]
  
  @@index([workCenterId])
  @@index([status])
  @@map("equipment")
}

model MaintenancePlan {
  id            String    @id @default(uuid())
  equipmentId   String
  planType      String    // "PREVENTIVE", "PREDICTIVE"
  description   String
  
  // Frequência
  frequencyType String    // "TIME_BASED", "COUNTER_BASED", "CALENDAR"
  frequencyValue Float?   // Ex: 30 (dias), 100 (horas)
  frequencyUnit String?   // "DAYS", "HOURS", "CYCLES"
  
  // Próxima manutenção
  lastExecution DateTime?
  nextExecution DateTime?
  counterAtLastExecution Float?
  counterAtNextExecution Float?
  
  // Recursos
  estimatedDuration Float? // Horas
  estimatedCost Float?
  
  active        Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  equipment     Equipment @relation(fields: [equipmentId], references: [id])
  orders        MaintenanceOrder[]
  
  @@index([equipmentId])
  @@index([nextExecution])
  @@map("maintenance_plans")
}

model MaintenanceOrder {
  id            String    @id @default(uuid())
  orderNumber   String    @unique
  equipmentId   String
  planId        String?   // NULL se for corretiva
  workCenterId  String?
  
  orderType     String    // "PREVENTIVE", "CORRECTIVE", "PREDICTIVE", "EMERGENCY"
  priority      String    @default("NORMAL") // "LOW", "NORMAL", "HIGH", "CRITICAL"
  
  description   String    @db.Text
  failureDescription String? @db.Text
  
  // Status e datas
  status        String    @default("PLANNED") // "PLANNED", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"
  scheduledDate DateTime?
  startedAt     DateTime?
  completedAt   DateTime?
  
  // Recursos
  estimatedDuration Float? // Horas
  actualDuration Float?
  estimatedCost Float?
  actualCost    Float?
  
  // Parada de produção
  causedDowntime Boolean  @default(false)
  downtimeMinutes Float?
  
  notes         String?   @db.Text
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  createdBy     String
  
  equipment     Equipment @relation(fields: [equipmentId], references: [id])
  plan          MaintenancePlan? @relation(fields: [planId], references: [id])
  workCenter    WorkCenter? @relation(fields: [workCenterId], references: [id])
  executions    MaintenanceExecution[]
  parts         MaintenancePart[]
  
  @@index([equipmentId])
  @@index([status])
  @@index([orderType])
  @@index([scheduledDate])
  @@map("maintenance_orders")
}

model MaintenanceExecution {
  id            String    @id @default(uuid())
  maintenanceOrderId String
  
  description   String    @db.Text
  startTime     DateTime
  endTime       DateTime
  durationMinutes Float
  
  technician    String
  laborCost     Float?
  
  notes         String?   @db.Text
  createdAt     DateTime  @default(now())
  
  maintenanceOrder MaintenanceOrder @relation(fields: [maintenanceOrderId], references: [id], onDelete: Cascade)
  
  @@index([maintenanceOrderId])
  @@map("maintenance_executions")
}

model MaintenancePart {
  id            String    @id @default(uuid())
  maintenanceOrderId String
  productId     String    // Peça de reposição
  quantity      Float
  unitCost      Float
  totalCost     Float
  notes         String?
  
  maintenanceOrder MaintenanceOrder @relation(fields: [maintenanceOrderId], references: [id], onDelete: Cascade)
  
  @@index([maintenanceOrderId])
  @@map("maintenance_parts")
}

model EquipmentCounter {
  id            String    @id @default(uuid())
  equipmentId   String
  readingDate   DateTime  @default(now())
  counterValue  Float
  notes         String?
  recordedBy    String
  
  equipment     Equipment @relation(fields: [equipmentId], references: [id])
  
  @@index([equipmentId])
  @@index([readingDate])
  @@map("equipment_counters")
}
```

## 9. Qualidade

```prisma
model InspectionPlan {
  id            String    @id @default(uuid())
  code          String    @unique
  name          String
  description   String?
  
  // Aplicação
  applicationType String  // "PRODUCT", "SUPPLIER", "PROCESS"
  productId     String?
  supplierId    String?
  operationId   String?
  
  // Tipo de inspeção
  inspectionType String   // "RECEIPT", "IN_PROCESS", "FINAL", "PERIODIC"
  
  // Amostragem
  samplingType  String    // "FULL", "SAMPLE", "STATISTICAL"
  sampleSize    Int?
  acceptanceLevel Float?  // AQL
  
  active        Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  characteristics InspectionCharacteristic[]
  inspections   QualityInspection[]
  
  @@map("inspection_plans")
}

model InspectionCharacteristic {
  id            String    @id @default(uuid())
  planId        String
  sequence      Int
  characteristic String
  measurementType String  // "VARIABLE", "ATTRIBUTE"
  
  // Para variáveis
  nominalValue  Float?
  lowerLimit    Float?
  upperLimit    Float?
  unit          String?
  
  // Para atributos
  acceptanceCriteria String? @db.Text
  
  mandatory     Boolean   @default(true)
  
  plan          InspectionPlan @relation(fields: [planId], references: [id], onDelete: Cascade)
  
  @@index([planId])
  @@map("inspection_characteristics")
}

model QualityInspection {
  id            String    @id @default(uuid())
  inspectionNumber String @unique
  planId        String
  
  // Referência
  referenceType String    // "PURCHASE_ORDER", "PRODUCTION_ORDER", "LOT"
  referenceId   String
  
  // Dados da inspeção
  inspectionDate DateTime @default(now())
  inspectedBy   String
  
  // Resultado
  status        String    @default("PENDING") // "PENDING", "APPROVED", "REJECTED", "CONDITIONAL"
  result        String?   // "PASS", "FAIL"
  
  // Quantidades
  lotSize       Float?
  sampleSize    Float?
  approvedQty   Float?
  rejectedQty   Float?
  
  notes         String?   @db.Text
  createdAt     DateTime  @default(now())
  
  plan          InspectionPlan @relation(fields: [planId], references: [id])
  measurements  InspectionMeasurement[]
  nonConformities NonConformity[]
  
  @@index([planId])
  @@index([referenceType, referenceId])
  @@index([status])
  @@map("quality_inspections")
}

model InspectionMeasurement {
  id            String    @id @default(uuid())
  inspectionId  String
  characteristicId String
  
  // Medição
  measuredValue Float?
  attributeResult String? // "OK", "NOK"
  
  // Conformidade
  isConforming  Boolean
  deviation     Float?
  
  notes         String?
  
  inspection    QualityInspection @relation(fields: [inspectionId], references: [id], onDelete: Cascade)
  
  @@index([inspectionId])
  @@map("inspection_measurements")
}

model NonConformity {
  id            String    @id @default(uuid())
  ncNumber      String    @unique
  
  // Origem
  sourceType    String    // "INSPECTION", "PRODUCTION", "CUSTOMER_COMPLAINT"
  sourceId      String?
  inspectionId  String?
  
  // Classificação
  type          String    // "PRODUCT", "PROCESS", "SYSTEM"
  severity      String    // "MINOR", "MAJOR", "CRITICAL"
  
  // Descrição
  description   String    @db.Text
  rootCause     String?   @db.Text
  
  // Produto/Lote afetado
  productId     String?
  lotId         String?
  quantity      Float?
  
  // Status
  status        String    @default("OPEN") // "OPEN", "IN_ANALYSIS", "CORRECTIVE_ACTION", "CLOSED"
  
  // Datas
  detectedAt    DateTime  @default(now())
  closedAt      DateTime?
  
  detectedBy    String
  responsibleBy String?
  
  inspection    QualityInspection? @relation(fields: [inspectionId], references: [id])
  correctiveActions CorrectiveAction[]
  
  @@index([status])
  @@index([severity])
  @@index([detectedAt])
  @@map("non_conformities")
}

model CorrectiveAction {
  id            String    @id @default(uuid())
  nonConformityId String
  actionNumber  String    @unique
  
  // Ação
  actionType    String    // "IMMEDIATE", "CORRECTIVE", "PREVENTIVE"
  description   String    @db.Text
  
  // Responsabilidade
  responsibleBy String
  dueDate       DateTime
  
  // Status
  status        String    @default("PLANNED") // "PLANNED", "IN_PROGRESS", "COMPLETED", "VERIFIED"
  completedAt   DateTime?
  verifiedAt    DateTime?
  verifiedBy    String?
  
  // Eficácia
  effectiveness String?   // "EFFECTIVE", "INEFFECTIVE", "PENDING"
  
  notes         String?   @db.Text
  createdAt     DateTime  @default(now())
  
  nonConformity NonConformity @relation(fields: [nonConformityId], references: [id])
  
  @@index([nonConformityId])
  @@index([status])
  @@index([dueDate])
  @@map("corrective_actions")
}

model QualityCertificate {
  id            String    @id @default(uuid())
  certificateNumber String @unique
  
  // Referência
  referenceType String    // "LOT", "PRODUCTION_ORDER", "SALES_ORDER"
  referenceId   String
  
  productId     String
  lotId         String?
  quantity      Float
  
  // Certificado
  issueDate     DateTime  @default(now())
  expirationDate DateTime?
  
  // Conformidade
  isConforming  Boolean   @default(true)
  specifications Json?    // Especificações atendidas
  testResults   Json?     // Resultados de testes
  
  notes         String?   @db.Text
  issuedBy      String
  
  @@index([certificateNumber])
  @@index([referenceType, referenceId])
  @@map("quality_certificates")
}
```

## 10. Indicadores e Relatórios

```prisma
model KPI {
  id            String    @id @default(uuid())
  code          String    @unique
  name          String
  description   String?
  category      String    // "PRODUCTION", "QUALITY", "MAINTENANCE", "INVENTORY"
  
  // Cálculo
  calculationType String  // "MANUAL", "AUTOMATIC"
  formula       String?   @db.Text
  unit          String?   // "%", "hours", "units", etc.
  
  // Metas
  targetValue   Float?
  minValue      Float?
  maxValue      Float?
  
  // Frequência
  frequency     String    // "DAILY", "WEEKLY", "MONTHLY"
  
  active        Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  values        KPIValue[]
  
  @@map("kpis")
}

model KPIValue {
  id            String    @id @default(uuid())
  kpiId         String
  period        DateTime  @db.Date
  value         Float
  target        Float?
  
  // Dimensões (opcional)
  workCenterId  String?
  productId     String?
  
  notes         String?
  calculatedAt  DateTime  @default(now())
  calculatedBy  String?
  
  kpi           KPI       @relation(fields: [kpiId], references: [id])
  
  @@unique([kpiId, period, workCenterId, productId])
  @@index([kpiId])
  @@index([period])
  @@map("kpi_values")
}

model Report {
  id            String    @id @default(uuid())
  code          String    @unique
  name          String
  description   String?
  category      String    // "PRODUCTION", "INVENTORY", "QUALITY", "MAINTENANCE"
  type          String    // "OPERATIONAL", "TACTICAL", "STRATEGIC"
  
  // Configuração
  queryConfig   Json?     // Configuração da query
  parameters    Json?     // Parâmetros do relatório
  
  // Formato
  outputFormat  String    @default("PDF") // "PDF", "EXCEL", "CSV"
  
  active        Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  createdBy     String
  
  executions    ReportExecution[]
  
  @@map("reports")
}

model ReportExecution {
  id            String    @id @default(uuid())
  reportId      String
  
  // Execução
  executedAt    DateTime  @default(now())
  executedBy    String
  parameters    Json?     // Parâmetros usados
  
  // Resultado
  status        String    @default("RUNNING") // "RUNNING", "COMPLETED", "ERROR"
  filePath      String?
  fileSize      Int?
  errorMessage  String?   @db.Text
  
  completedAt   DateTime?
  
  report        Report    @relation(fields: [reportId], references: [id])
  
  @@index([reportId])
  @@index([executedAt])
  @@map("report_executions")
}

model Dashboard {
  id            String    @id @default(uuid())
  code          String    @unique
  name          String
  description   String?
  
  // Configuração
  layout        Json      // Configuração do layout
  widgets       Json      // Widgets e suas configurações
  
  // Permissões
  isPublic      Boolean   @default(false)
  ownerId       String
  
  active        Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  @@map("dashboards")
}
```

## 11. Configurações e Sistema

```prisma
model SystemConfig {
  id            String    @id @default(uuid())
  key           String    @unique
  value         String    @db.Text
  dataType      String    // "STRING", "NUMBER", "BOOLEAN", "JSON"
  category      String    // "GENERAL", "PRODUCTION", "INVENTORY", etc.
  description   String?
  isEditable    Boolean   @default(true)
  updatedAt     DateTime  @updatedAt
  updatedBy     String?
  
  @@map("system_config")
}

model Notification {
  id            String    @id @default(uuid())
  userId        String
  type          String    // "INFO", "WARNING", "ERROR", "SUCCESS"
  category      String    // "PRODUCTION", "INVENTORY", "MAINTENANCE", "QUALITY"
  title         String
  message       String    @db.Text
  
  // Referência
  referenceType String?
  referenceId   String?
  
  // Status
  isRead        Boolean   @default(false)
  readAt        DateTime?
  
  createdAt     DateTime  @default(now())
  expiresAt     DateTime?
  
  @@index([userId, isRead])
  @@index([createdAt])
  @@map("notifications")
}

model Webhook {
  id            String    @id @default(uuid())
  name          String
  url           String
  method        String    @default("POST") // "POST", "PUT"
  headers       Json?
  
  // Eventos
  events        String[]  // ["production_order.completed", "stock.low", etc.]
  
  // Status
  active        Boolean   @default(true)
  lastTriggered DateTime?
  lastStatus    String?   // "SUCCESS", "FAILED"
  
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  logs          WebhookLog[]
  
  @@map("webhooks")
}

model WebhookLog {
  id            String    @id @default(uuid())
  webhookId     String
  event         String
  payload       Json
  response      Json?
  statusCode    Int?
  success       Boolean
  errorMessage  String?   @db.Text
  triggeredAt   DateTime  @default(now())
  
  webhook       Webhook   @relation(fields: [webhookId], references: [id])
  
  @@index([webhookId])
  @@index([triggeredAt])
  @@map("webhook_logs")
}
```

## 📊 Resumo do Modelo

### **Total de Entidades: 70+**

- **Segurança**: 7 models
- **Cadastros**: 6 models
- **Engenharia**: 7 models
- **Planejamento**: 6 models
- **Estoque**: 9 models
- **Produção**: 6 models
- **Compras**: 10 models
- **Manutenção**: 7 models
- **Qualidade**: 9 models
- **Indicadores**: 6 models
- **Sistema**: 5 models

### **Relacionamentos Principais**

- User → ProductionPointing (1:N)
- Product → BOM → BOMItem (1:N:N)
- Product → Routing → RoutingOperation (1:N:N)
- ProductionOrder → ProductionOrderOperation → ProductionPointing (1:N:N)
- Stock → Product, Warehouse, Location, Lot (N:1 cada)
- Equipment → MaintenancePlan → MaintenanceOrder (1:N:N)

### **Índices Estratégicos**

Todos os campos frequentemente usados em queries possuem índices:
- Status e datas
- Chaves estrangeiras
- Campos de busca
- Campos de ordenação
