-- AlterTable
ALTER TABLE `stock_movements` ADD COLUMN `notes` VARCHAR(191) NULL,
    ADD COLUMN `referenceType` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `stock_movements_type_idx` ON `stock_movements`(`type`);

-- CreateIndex
CREATE INDEX `stock_movements_reference_idx` ON `stock_movements`(`reference`);

-- AddForeignKey
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
