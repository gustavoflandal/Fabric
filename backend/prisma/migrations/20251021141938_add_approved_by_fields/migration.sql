-- AlterTable
ALTER TABLE `purchase_orders` ADD COLUMN `approvedAt` DATETIME(3) NULL,
    ADD COLUMN `approvedBy` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `purchase_quotations` ADD COLUMN `approvedAt` DATETIME(3) NULL,
    ADD COLUMN `approvedBy` VARCHAR(191) NULL;
