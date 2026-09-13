-- AlterEnum
ALTER TABLE `yard_visits` MODIFY `status` ENUM('SCHEDULED', 'CHECKED_IN', 'IN_YARD', 'AT_DOCK', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'SCHEDULED';

-- AlterTable
ALTER TABLE `yard_visits` ADD COLUMN `yardDockId` VARCHAR(191) NULL,
ADD COLUMN `dockArrivedAt` DATETIME(3) NULL,
ADD COLUMN `loadingStartedAt` DATETIME(3) NULL,
ADD COLUMN `loadingEndedAt` DATETIME(3) NULL,
ADD COLUMN `completedAt` DATETIME(3) NULL;

-- AddForeignKey
ALTER TABLE `yard_visits` ADD CONSTRAINT `yard_visits_yardDockId_fkey` FOREIGN KEY (`yardDockId`) REFERENCES `yard_docks`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
