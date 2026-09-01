-- Fase 4 do cronograma, item 4.3: indices compostos para as tabelas de maior
-- volume (stock_movements, audit_logs, production_pointings,
-- production_orders) e constraints unicas que faltavam (CountingItem,
-- CountingSession, BOMItem, RoutingOperation, Supplier.document,
-- Customer.document). Nenhuma linha existente viola essas constraints
-- (verificado antes de escrever esta migration - ver commit).

-- CreateIndex
CREATE INDEX `audit_logs_userId_createdAt_idx` ON `audit_logs`(`userId`, `createdAt`);

-- CreateIndex
CREATE INDEX `audit_logs_resourceId_idx` ON `audit_logs`(`resourceId`);

-- CreateIndex
CREATE INDEX `audit_logs_resource_resourceId_createdAt_idx` ON `audit_logs`(`resource`, `resourceId`, `createdAt`);

-- CreateIndex
CREATE UNIQUE INDEX `bom_items_bomId_componentId_key` ON `bom_items`(`bomId`, `componentId`);

-- CreateIndex
CREATE UNIQUE INDEX `bom_items_bomId_sequence_key` ON `bom_items`(`bomId`, `sequence`);

-- CreateIndex
CREATE UNIQUE INDEX `counting_items_sessionId_productId_locationId_key` ON `counting_items`(`sessionId`, `productId`, `locationId`);

-- CreateIndex
CREATE UNIQUE INDEX `counting_sessions_planId_scheduledDate_key` ON `counting_sessions`(`planId`, `scheduledDate`);

-- CreateIndex
CREATE UNIQUE INDEX `customers_document_key` ON `customers`(`document`);

-- CreateIndex
CREATE INDEX `production_orders_status_scheduledStart_idx` ON `production_orders`(`status`, `scheduledStart`);

-- CreateIndex
CREATE INDEX `production_pointings_operationId_startTime_idx` ON `production_pointings`(`operationId`, `startTime`);

-- CreateIndex
CREATE INDEX `production_pointings_userId_startTime_idx` ON `production_pointings`(`userId`, `startTime`);

-- CreateIndex
CREATE UNIQUE INDEX `routing_operations_routingId_sequence_key` ON `routing_operations`(`routingId`, `sequence`);

-- CreateIndex
CREATE INDEX `stock_movements_productId_createdAt_idx` ON `stock_movements`(`productId`, `createdAt`);

-- CreateIndex
CREATE INDEX `stock_movements_referenceType_reference_idx` ON `stock_movements`(`referenceType`, `reference`);

-- CreateIndex
CREATE UNIQUE INDEX `suppliers_document_key` ON `suppliers`(`document`);

