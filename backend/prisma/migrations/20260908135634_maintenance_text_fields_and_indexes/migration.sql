-- AlterTable
ALTER TABLE `maintenance_orders` MODIFY `problemDescription` TEXT NULL,
    MODIFY `resolutionNotes` TEXT NULL;

-- AlterTable
ALTER TABLE `maintenance_plans` MODIFY `description` TEXT NULL;

-- CreateIndex
CREATE INDEX `maintenance_orders_status_createdAt_idx` ON `maintenance_orders`(`status`, `createdAt`);

-- CreateIndex
CREATE INDEX `maintenance_plans_active_nextDueDate_idx` ON `maintenance_plans`(`active`, `nextDueDate`);

