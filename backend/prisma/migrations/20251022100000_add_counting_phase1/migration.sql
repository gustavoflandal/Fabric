-- Adicionar tabela de produtos em planos de contagem
CREATE TABLE IF NOT EXISTS `counting_plan_products` (
        `id` VARCHAR(191) NOT NULL,
        `plan_id` VARCHAR(191) NOT NULL,
        `product_id` VARCHAR(191) NOT NULL,
        `priority` INT NOT NULL DEFAULT 0,
        `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        `updated_at` DATETIME(3) NOT NULL,
    
        PRIMARY KEY (`id`),
        UNIQUE INDEX `counting_plan_products_plan_id_product_id_key` (`plan_id`, `product_id`),
        CONSTRAINT `counting_plan_products_plan_id_fkey`
            FOREIGN KEY (`plan_id`) REFERENCES `counting_plans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT `counting_plan_products_product_id_fkey`
            FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Adicionar tabela de atribuição de contadores
CREATE TABLE IF NOT EXISTS `counting_assignments` (
        `id` VARCHAR(191) NOT NULL,
        `session_id` VARCHAR(191) NOT NULL,
        `user_id` VARCHAR(191) NOT NULL,
        `role` ENUM('PRIMARY', 'SECONDARY', 'VALIDATOR', 'SUPERVISOR') NOT NULL,
        `assigned_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    
        PRIMARY KEY (`id`),
        UNIQUE INDEX `counting_assignments_session_id_user_id_key` (`session_id`, `user_id`),
        CONSTRAINT `counting_assignments_session_id_fkey`
            FOREIGN KEY (`session_id`) REFERENCES `counting_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT `counting_assignments_user_id_fkey`
            FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Adicionar campo de sequência na tabela de itens de contagem
SET @sequence_col_exists := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'counting_items'
        AND COLUMN_NAME = 'sequence'
);

SET @sql := IF(
    @sequence_col_exists = 0,
    'ALTER TABLE `counting_items` ADD COLUMN `sequence` INT DEFAULT 0 AFTER `recountedAt`',
    'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
