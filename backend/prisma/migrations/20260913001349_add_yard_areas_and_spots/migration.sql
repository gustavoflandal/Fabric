-- AlterTable
ALTER TABLE `yard_visits` ADD COLUMN `yardSpotId` VARCHAR(191) NULL,
    MODIFY `status` ENUM('SCHEDULED', 'CHECKED_IN', 'IN_YARD', 'CANCELLED') NOT NULL DEFAULT 'SCHEDULED';

-- CreateTable
CREATE TABLE `yard_areas` (
    `id` VARCHAR(191) NOT NULL,
    `warehouseId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `blocked` BOOLEAN NOT NULL DEFAULT false,
    `blockedReason` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `yard_areas_warehouseId_code_key`(`warehouseId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `yard_spots` (
    `id` VARCHAR(191) NOT NULL,
    `areaId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `blocked` BOOLEAN NOT NULL DEFAULT false,
    `blockedReason` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `yard_spots_areaId_code_key`(`areaId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `yard_visits` ADD CONSTRAINT `yard_visits_yardSpotId_fkey` FOREIGN KEY (`yardSpotId`) REFERENCES `yard_spots`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `yard_areas` ADD CONSTRAINT `yard_areas_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `yard_spots` ADD CONSTRAINT `yard_spots_areaId_fkey` FOREIGN KEY (`areaId`) REFERENCES `yard_areas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

