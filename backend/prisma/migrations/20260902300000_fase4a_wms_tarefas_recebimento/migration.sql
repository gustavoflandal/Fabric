-- Fase 4a do plano do WMS - Recebimento orientado a tarefa
-- (docs/fase-2026-09-modernizacao/WMS_IMPLEMENTATION_ANALYSIS.md, secao 5,
--  itens F4.1 a F4.5; secao 3.3 de 04_ARQUITETURA_MODULAR_LICENCIAMENTO.md).
--
-- Cobre:
--   F4.1 - `warehouse_tasks` (+ os enums inline `WarehouseTaskType` e
--          `WarehouseTaskStatus`, que no MySQL existem como o tipo das colunas
--          `type` e `status`, nao como objeto proprio do banco).
--   F4.4 - `receipt_putaways` (enderecamento de item conferido; 1:N com
--          `purchase_receipt_items` porque um item pode ir para mais de uma
--          posicao).
--
-- PURAMENTE ADITIVA: duas tabelas novas, nenhuma coluna alterada, nenhum dado
-- tocado. Uma instalacao sem WMS licenciado nunca escreve uma linha nelas -
-- `purchase-receipt.service.ts::create()` so gera tarefa quando
-- `isModuleEnabled('WMS')` e verdadeiro.
--
-- F4.2 (`PurchaseReceipt.status` ganhando `CONFERIDO`) NAO aparece aqui: a
-- coluna ja e `VARCHAR` livre, o valor novo e de aplicacao, nao de schema.
--
-- TODAS as FKs sao ON DELETE RESTRICT, inclusive as obrigatorias (onde e o
-- default) - explicitas para nao depender do default e, nas OPCIONAIS de
-- posicao (`fromPositionId`/`toPositionId`), para nao virarem SET NULL por
-- omissao: e o mesmo padrao ja estabelecido em `stock_movements` e
-- `counting_items` nas fases anteriores. Consequencia deliberada: cancelar um
-- recebimento com enderecamento passa por
-- `purchase-receipt.service.ts::cancel()`, que estorna o estoque e apaga os
-- putaways ANTES de apagar o recebimento; um DELETE direto no banco e barrado.

-- CreateTable
CREATE TABLE `warehouse_tasks` (
    `id` VARCHAR(191) NOT NULL,
    `type` ENUM('DESCARGA', 'CONFERENCIA', 'ETIQUETAGEM', 'QUARENTENA', 'ALOCACAO') NOT NULL,
    `status` ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `reference` VARCHAR(191) NULL,
    `referenceType` VARCHAR(191) NULL,
    `fromPositionId` VARCHAR(191) NULL,
    `toPositionId` VARCHAR(191) NULL,
    `productId` VARCHAR(191) NULL,
    `quantity` DECIMAL(18, 4) NULL,
    `priority` INTEGER NOT NULL DEFAULT 0,
    `assignedTo` VARCHAR(191) NULL,
    `sequence` INTEGER NULL,
    `version` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,

    INDEX `warehouse_tasks_referenceType_reference_idx`(`referenceType`, `reference`),
    INDEX `warehouse_tasks_assignedTo_status_idx`(`assignedTo`, `status`),
    INDEX `warehouse_tasks_status_priority_idx`(`status`, `priority`),
    INDEX `warehouse_tasks_type_status_idx`(`type`, `status`),
    INDEX `warehouse_tasks_fromPositionId_idx`(`fromPositionId`),
    INDEX `warehouse_tasks_toPositionId_idx`(`toPositionId`),
    INDEX `warehouse_tasks_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `receipt_putaways` (
    `id` VARCHAR(191) NOT NULL,
    `receiptItemId` VARCHAR(191) NOT NULL,
    `storagePositionId` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(18, 4) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `putawayAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `taskId` VARCHAR(191) NOT NULL,

    INDEX `receipt_putaways_receiptItemId_idx`(`receiptItemId`),
    INDEX `receipt_putaways_storagePositionId_idx`(`storagePositionId`),
    INDEX `receipt_putaways_taskId_idx`(`taskId`),
    INDEX `receipt_putaways_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `warehouse_tasks` ADD CONSTRAINT `warehouse_tasks_fromPositionId_fkey` FOREIGN KEY (`fromPositionId`) REFERENCES `storage_positions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `warehouse_tasks` ADD CONSTRAINT `warehouse_tasks_toPositionId_fkey` FOREIGN KEY (`toPositionId`) REFERENCES `storage_positions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `warehouse_tasks` ADD CONSTRAINT `warehouse_tasks_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `warehouse_tasks` ADD CONSTRAINT `warehouse_tasks_assignedTo_fkey` FOREIGN KEY (`assignedTo`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `receipt_putaways` ADD CONSTRAINT `receipt_putaways_receiptItemId_fkey` FOREIGN KEY (`receiptItemId`) REFERENCES `purchase_receipt_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `receipt_putaways` ADD CONSTRAINT `receipt_putaways_storagePositionId_fkey` FOREIGN KEY (`storagePositionId`) REFERENCES `storage_positions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `receipt_putaways` ADD CONSTRAINT `receipt_putaways_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `receipt_putaways` ADD CONSTRAINT `receipt_putaways_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `warehouse_tasks`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

