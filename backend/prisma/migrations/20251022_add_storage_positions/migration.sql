-- CreateTable
CREATE TABLE `storage_positions` (
    `id` VARCHAR(191) NOT NULL,
    `structureId` VARCHAR(191) NOT NULL,
    `warehouseCode` VARCHAR(191) NOT NULL,
    `streetCode` VARCHAR(191) NOT NULL,
    `floor` INTEGER NOT NULL,
    `position` INTEGER NOT NULL,
    `positionType` ENUM('PORTA_PALETES', 'MINI_PORTA_PALETES', 'DRIVE_IN', 'DRIVE_THROUGH', 'PUSH_BACK', 'FLOW_RACK', 'CANTILEVER', 'MEZANINO', 'AUTOPORTANTE', 'RACKS', 'CARROSSEL', 'MINI_LOAD', 'ESTANTES_INDUSTRIAIS') NOT NULL,
    `weightCapacity` DOUBLE NOT NULL,
    `height` DOUBLE NOT NULL,
    `width` DOUBLE NOT NULL,
    `depth` DOUBLE NOT NULL,
    `maxHeight` DOUBLE NOT NULL,
    `blocked` BOOLEAN NOT NULL DEFAULT false,
    `occupied` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `storage_positions_warehouseCode_streetCode_idx`(`warehouseCode`, `streetCode`),
    INDEX `storage_positions_blocked_idx`(`blocked`),
    INDEX `storage_positions_occupied_idx`(`occupied`),
    UNIQUE INDEX `storage_positions_structureId_floor_position_key`(`structureId`, `floor`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `storage_positions` ADD CONSTRAINT `storage_positions_structureId_fkey` FOREIGN KEY (`structureId`) REFERENCES `warehouse_structures`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
