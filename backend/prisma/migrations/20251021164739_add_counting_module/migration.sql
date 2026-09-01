-- CreateTable
CREATE TABLE `locations` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('WAREHOUSE', 'AREA', 'CORRIDOR', 'SHELF', 'BIN', 'FLOOR') NOT NULL,
    `parentId` VARCHAR(191) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `locations_code_key`(`code`),
    INDEX `locations_parentId_idx`(`parentId`),
    INDEX `locations_type_active_idx`(`type`, `active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `counting_plans` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `type` ENUM('CYCLIC', 'SPOT', 'FULL_INVENTORY', 'BLIND') NOT NULL,
    `frequency` ENUM('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL', 'ON_DEMAND') NULL,
    `status` ENUM('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `criteria` JSON NULL,
    `allowBlindCount` BOOLEAN NOT NULL DEFAULT true,
    `requireRecount` BOOLEAN NOT NULL DEFAULT true,
    `tolerancePercent` DECIMAL(5, 2) NULL,
    `toleranceQty` INTEGER NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NULL,
    `nextExecution` DATETIME(3) NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `counting_plans_code_key`(`code`),
    INDEX `counting_plans_status_nextExecution_idx`(`status`, `nextExecution`),
    INDEX `counting_plans_type_frequency_idx`(`type`, `frequency`),
    INDEX `counting_plans_createdBy_idx`(`createdBy`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `counting_sessions` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `planId` VARCHAR(191) NOT NULL,
    `status` ENUM('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'SCHEDULED',
    `scheduledDate` DATETIME(3) NOT NULL,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `assignedTo` VARCHAR(191) NULL,
    `completedBy` VARCHAR(191) NULL,
    `totalItems` INTEGER NOT NULL DEFAULT 0,
    `countedItems` INTEGER NOT NULL DEFAULT 0,
    `itemsWithDiff` INTEGER NOT NULL DEFAULT 0,
    `accuracyPercent` DECIMAL(5, 2) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `counting_sessions_code_key`(`code`),
    INDEX `counting_sessions_planId_idx`(`planId`),
    INDEX `counting_sessions_status_scheduledDate_idx`(`status`, `scheduledDate`),
    INDEX `counting_sessions_assignedTo_idx`(`assignedTo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `counting_items` (
    `id` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `locationId` VARCHAR(191) NULL,
    `systemQty` DECIMAL(10, 2) NOT NULL,
    `countedQty` DECIMAL(10, 2) NULL,
    `recountQty` DECIMAL(10, 2) NULL,
    `finalQty` DECIMAL(10, 2) NULL,
    `difference` DECIMAL(10, 2) NULL,
    `differencePercent` DECIMAL(5, 2) NULL,
    `hasDifference` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('PENDING', 'COUNTED', 'RECOUNTED', 'ADJUSTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `notes` TEXT NULL,
    `reason` TEXT NULL,
    `countedBy` VARCHAR(191) NULL,
    `countedAt` DATETIME(3) NULL,
    `recountedBy` VARCHAR(191) NULL,
    `recountedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `counting_items_sessionId_status_idx`(`sessionId`, `status`),
    INDEX `counting_items_productId_idx`(`productId`),
    INDEX `counting_items_hasDifference_idx`(`hasDifference`),
    INDEX `counting_items_countedBy_idx`(`countedBy`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_reference_fkey` FOREIGN KEY (`reference`) REFERENCES `counting_sessions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `locations` ADD CONSTRAINT `locations_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `locations`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `counting_plans` ADD CONSTRAINT `counting_plans_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `counting_sessions` ADD CONSTRAINT `counting_sessions_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `counting_plans`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `counting_sessions` ADD CONSTRAINT `counting_sessions_assignedTo_fkey` FOREIGN KEY (`assignedTo`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `counting_sessions` ADD CONSTRAINT `counting_sessions_completedBy_fkey` FOREIGN KEY (`completedBy`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `counting_items` ADD CONSTRAINT `counting_items_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `counting_sessions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `counting_items` ADD CONSTRAINT `counting_items_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `counting_items` ADD CONSTRAINT `counting_items_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `counting_items` ADD CONSTRAINT `counting_items_countedBy_fkey` FOREIGN KEY (`countedBy`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `counting_items` ADD CONSTRAINT `counting_items_recountedBy_fkey` FOREIGN KEY (`recountedBy`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
