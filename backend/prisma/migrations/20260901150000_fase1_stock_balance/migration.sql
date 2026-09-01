-- Fase 1 do cronograma (docs/fase-2026-09-modernizacao/02_CRONOGRAMA_IMPLEMENTACOES.md,
-- itens 1.1/1.2): saldo de estoque persistido, para permitir SELECT ... FOR UPDATE
-- dentro de transacao e eliminar a race condition de reservar/movimentar estoque
-- concorrentemente. Antes o saldo era somado em memoria a partir de TODO o
-- historico de stock_movements a cada consulta - nao havia linha para travar.

-- CreateTable
CREATE TABLE `stock_balances` (
    `id` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `quantity` DOUBLE NOT NULL DEFAULT 0,
    `version` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `stock_balances_productId_key`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `stock_balances` ADD CONSTRAINT `stock_balances_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: uma linha de saldo por produto que ja teve movimentacao, calculada
-- com a MESMA convencao de sinal que o antigo getBalance() usava em memoria
-- (IN e ADJUSTMENT somam, OUT subtrai) para nao alterar retroativamente nenhum
-- saldo historico. A correcao do sinal de ADJUSTMENT (ver
-- counting-session.service.ts) so vale para movimentacoes novas, criadas a
-- partir de agora atraves do stockService.
INSERT INTO `stock_balances` (`id`, `productId`, `quantity`, `version`, `updatedAt`)
SELECT UUID(), `productId`,
       SUM(CASE WHEN `type` = 'OUT' THEN -`quantity` ELSE `quantity` END),
       0,
       NOW(3)
FROM `stock_movements`
GROUP BY `productId`;
