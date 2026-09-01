-- Fase 1 do cronograma de modernizacao (docs/fase-2026-09-modernizacao/02_CRONOGRAMA_IMPLEMENTACOES.md,
-- item 1.3 e 1.4): reconcilia o schema.prisma com o estado real do banco.
--
-- Confirmado antes de escrever esta migration (prisma migrate diff --from-url <db> --to-schema-datamodel):
-- - counting_assignments e counting_plan_products foram criadas via SQL manual com colunas
--   snake_case, mas o schema.prisma sempre esperou camelCase (sem @map de campo) - toda
--   query do Prisma contra essas tabelas falhava. Ambas as tabelas estao vazias em todos os
--   ambientes conhecidos ate agora, mas o rename abaixo usa CHANGE COLUMN (preserva dados)
--   em vez de DROP+ADD, para ser seguro mesmo se alguma linha já existir em outro ambiente.
-- - counting_plans.priority, warehouses e warehouse_structures existem no schema mas nunca
--   tiveram migration correspondente (warehouses/warehouse_structures nem existiam no banco).
-- - storage_positions ja foi criada por uma migration anterior que testava a existencia de
--   warehouse_structures em tempo de execucao e pulava a FK quando a tabela nao existia
--   (20251022_add_storage_positions) - agora que a tabela existe, a FK e adicionada aqui.
-- - stock_movements.reference é um campo polimórfico ("ID da OP, Pedido, etc", ver
--   referenceType: PRODUCTION/PURCHASE/ADJUSTMENT/MANUAL/COUNTING) que tinha uma FK fixa
--   para counting_sessions, quebrando para os outros tipos. Substituída por uma coluna
--   dedicada countingSessionId, preenchida só quando referenceType = COUNTING.

-- ============================================
-- 1) counting_assignments: renomear colunas para camelCase (sem perda de dados)
-- ============================================
ALTER TABLE `counting_assignments` DROP FOREIGN KEY `counting_assignments_session_id_fkey`;
ALTER TABLE `counting_assignments` DROP FOREIGN KEY `counting_assignments_user_id_fkey`;
DROP INDEX `counting_assignments_session_id_user_id_key` ON `counting_assignments`;

ALTER TABLE `counting_assignments`
    CHANGE COLUMN `session_id` `sessionId` VARCHAR(191) NOT NULL,
    CHANGE COLUMN `user_id` `userId` VARCHAR(191) NOT NULL,
    CHANGE COLUMN `assigned_at` `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

CREATE UNIQUE INDEX `counting_assignments_sessionId_userId_key` ON `counting_assignments`(`sessionId`, `userId`);

ALTER TABLE `counting_assignments` ADD CONSTRAINT `counting_assignments_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `counting_sessions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `counting_assignments` ADD CONSTRAINT `counting_assignments_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================
-- 2) counting_plan_products: renomear colunas para camelCase (sem perda de dados)
-- ============================================
ALTER TABLE `counting_plan_products` DROP FOREIGN KEY `counting_plan_products_plan_id_fkey`;
ALTER TABLE `counting_plan_products` DROP FOREIGN KEY `counting_plan_products_product_id_fkey`;
DROP INDEX `counting_plan_products_plan_id_product_id_key` ON `counting_plan_products`;

ALTER TABLE `counting_plan_products`
    CHANGE COLUMN `plan_id` `planId` VARCHAR(191) NOT NULL,
    CHANGE COLUMN `product_id` `productId` VARCHAR(191) NOT NULL,
    CHANGE COLUMN `created_at` `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CHANGE COLUMN `updated_at` `updatedAt` DATETIME(3) NOT NULL;

CREATE UNIQUE INDEX `counting_plan_products_planId_productId_key` ON `counting_plan_products`(`planId`, `productId`);

ALTER TABLE `counting_plan_products` ADD CONSTRAINT `counting_plan_products_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `counting_plans`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `counting_plan_products` ADD CONSTRAINT `counting_plan_products_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================
-- 3) counting_plans: coluna priority faltante
-- ============================================
ALTER TABLE `counting_plans` ADD COLUMN `priority` INTEGER NOT NULL DEFAULT 5;

-- ============================================
-- 4) warehouses e warehouse_structures: tabelas nunca criadas
-- ============================================
CREATE TABLE `warehouses` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `legalName` VARCHAR(191) NULL,
    `document` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `state` VARCHAR(191) NULL,
    `zipCode` VARCHAR(191) NULL,
    `country` VARCHAR(191) NOT NULL DEFAULT 'BR',
    `managerName` VARCHAR(191) NULL,
    `capacity` DOUBLE NULL,
    `description` TEXT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `warehouses_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `warehouse_structures` (
    `id` VARCHAR(191) NOT NULL,
    `warehouseId` VARCHAR(191) NOT NULL,
    `streetCode` VARCHAR(191) NOT NULL,
    `floors` INTEGER NOT NULL,
    `positions` INTEGER NOT NULL,
    `weightCapacity` DOUBLE NOT NULL,
    `height` DOUBLE NOT NULL,
    `width` DOUBLE NOT NULL,
    `depth` DOUBLE NOT NULL,
    `maxHeight` DOUBLE NOT NULL,
    `blocked` BOOLEAN NOT NULL DEFAULT false,
    `positionType` ENUM('PORTA_PALETES', 'MINI_PORTA_PALETES', 'DRIVE_IN', 'DRIVE_THROUGH', 'PUSH_BACK', 'FLOW_RACK', 'CANTILEVER', 'MEZANINO', 'AUTOPORTANTE', 'RACKS', 'CARROSSEL', 'MINI_LOAD', 'ESTANTES_INDUSTRIAIS') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `warehouse_structures` ADD CONSTRAINT `warehouse_structures_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================
-- 5) storage_positions: FK para warehouse_structures que a migration anterior pulou
--    (warehouse_structures nao existia ainda no momento em que ela rodou)
-- ============================================
ALTER TABLE `storage_positions` ADD CONSTRAINT `storage_positions_structureId_fkey` FOREIGN KEY (`structureId`) REFERENCES `warehouse_structures`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- 6) stock_movements: FK polimorfica invalida -> coluna dedicada countingSessionId
-- ============================================
ALTER TABLE `stock_movements` DROP FOREIGN KEY `stock_movements_reference_fkey`;

ALTER TABLE `stock_movements` ADD COLUMN `countingSessionId` VARCHAR(191) NULL;

-- Migra dados existentes: onde a FK antiga so permitia valores validos de counting_sessions,
-- reference ja continha o id da sessao (referenceType = 'COUNTING'). Nao ha impacto para os
-- demais referenceType (PRODUCTION/PURCHASE/ADJUSTMENT/MANUAL), que nunca puderam ser gravados
-- com essa FK ativa.
UPDATE `stock_movements` SET `countingSessionId` = `reference` WHERE `referenceType` = 'COUNTING';

ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_countingSessionId_fkey` FOREIGN KEY (`countingSessionId`) REFERENCES `counting_sessions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
