-- AlterTable
ALTER TABLE `warehouse_tasks` MODIFY `type` ENUM('DESCARGA', 'CONFERENCIA', 'ETIQUETAGEM', 'QUARENTENA', 'SEGREGACAO', 'AMOSTRAGEM', 'ALOCACAO', 'PICKING', 'REPLENISHMENT') NOT NULL;

-- CreateTable
CREATE TABLE `workflow_templates` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `direction` ENUM('ENTRADA', 'SAIDA') NOT NULL DEFAULT 'ENTRADA',
    `active` BOOLEAN NOT NULL DEFAULT true,
    `priority` INTEGER NOT NULL DEFAULT 0,
    `triggerRule` JSON NULL,
    `entryNodeId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `workflow_templates_direction_active_priority_idx`(`direction`, `active`, `priority`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `workflow_nodes` (
    `id` VARCHAR(191) NOT NULL,
    `templateId` VARCHAR(191) NOT NULL,
    `type` ENUM('DESCARGA', 'CONFERENCIA', 'ETIQUETAGEM', 'QUARENTENA', 'SEGREGACAO', 'AMOSTRAGEM', 'ALOCACAO', 'DECISAO') NOT NULL,
    `label` VARCHAR(191) NULL,
    `conditionRule` JSON NULL,
    `positionX` DOUBLE NOT NULL,
    `positionY` DOUBLE NOT NULL,

    INDEX `workflow_nodes_templateId_idx`(`templateId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `workflow_edges` (
    `id` VARCHAR(191) NOT NULL,
    `templateId` VARCHAR(191) NOT NULL,
    `fromNodeId` VARCHAR(191) NOT NULL,
    `toNodeId` VARCHAR(191) NOT NULL,
    `branch` ENUM('SIM', 'NAO') NULL,

    INDEX `workflow_edges_templateId_idx`(`templateId`),
    INDEX `workflow_edges_fromNodeId_idx`(`fromNodeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `workflow_nodes` ADD CONSTRAINT `workflow_nodes_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `workflow_templates`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `workflow_edges` ADD CONSTRAINT `workflow_edges_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `workflow_templates`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
