-- Fase 5 do plano do WMS - Lote, validade e rastreabilidade
-- (docs/fase-2026-09-modernizacao/WMS_IMPLEMENTATION_ANALYSIS.md, secao 5,
--  Fase 5 - a fase condicional, executada apos as Fases 0 a 4).
--
-- Cobre:
--   * `products.lotTracked` - lote e OPT-IN POR PRODUTO. `false` por default,
--     logo TODA linha existente continua se comportando exatamente como antes.
--   * `lots` - a entidade nova (numero, fabricacao, validade, fornecedor
--     opcional), unica por (produto, numero de lote) e SEM campo de status:
--     vencimento e derivado de `expiresAt < now()` na hora da operacao.
--   * `stock_position_balances.lotId` - a TERCEIRA dimensao do saldo. O indice
--     unico passa de (produto, posicao) para (produto, posicao, lote).
--   * `stock_movements.lotId` - campo UNICO (nao um par from/to como as
--     posicoes): um lote nao vai de A para B, so muda de endereco.
--   * `warehouse_tasks.lotId` - o lote que o FEFO escolheu na criacao da tarefa
--     de PICKING (e o que a reposicao herdou da linha de saldo de origem).
--   * `purchase_receipt_items.{lotNumber,manufacturedAt,expiresAt}` - o que foi
--     LIDO na etiqueta durante a conferencia. O `Lot` em si so nasce na
--     conclusao da tarefa de ALOCACAO.
--
-- MIGRACAO DE DADOS: nenhuma. Tudo e aditivo e nullable, e `lotTracked` nasce
-- `false`. Nao existe backfill possivel nem desejavel - lote de material que ja
-- estava no armazem antes desta fase e informacao que o sistema nunca teve.
--
-- A TROCA DO INDICE UNICO e a unica operacao nao puramente aditiva, e e segura:
-- toda linha existente tem `lotId` NULL, e no MySQL NULL e distinto num indice
-- unico, entao (produto, posicao, NULL) nunca colide com nada. O efeito
-- colateral - o banco deixa de impedir sozinho DUAS linhas sem lote na mesma
-- posicao - e coberto pelo lock de `stock_balances` que
-- stock.service.ts::applyMovement() adquire antes de escrever qualquer linha
-- desta tabela (ver a nota de ordem de lock la e no schema).

-- ORDEM DAS OPERACOES (alterada a mao em relacao ao que o `prisma migrate diff`
-- gera, e o motivo precisa ficar registrado): o InnoDB usa o indice unico
-- (productId, storagePositionId) para sustentar a FK `productId`, entao
-- derruba-lo ANTES de existir outro indice com `productId` a esquerda falha com
-- "Cannot drop index ...: needed in a foreign key constraint" (erro 1553). O
-- novo unico (productId, storagePositionId, lotId) serve a mesma FK - `productId`
-- continua sendo a coluna mais a esquerda -, portanto ele e criado PRIMEIRO e o
-- antigo cai depois. O diff gerado automaticamente nao sabe disso; quem
-- regenerar esta migration precisa reordenar de novo.

-- AlterTable
ALTER TABLE `products` ADD COLUMN `lotTracked` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `purchase_receipt_items` ADD COLUMN `expiresAt` DATETIME(3) NULL,
    ADD COLUMN `lotNumber` VARCHAR(191) NULL,
    ADD COLUMN `manufacturedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `stock_movements` ADD COLUMN `lotId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `stock_position_balances` ADD COLUMN `lotId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `warehouse_tasks` ADD COLUMN `lotId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `lots` (
    `id` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `lotNumber` VARCHAR(191) NOT NULL,
    `manufacturedAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NULL,
    `supplierId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `lots_expiresAt_idx`(`expiresAt`),
    INDEX `lots_supplierId_idx`(`supplierId`),
    UNIQUE INDEX `lots_productId_lotNumber_key`(`productId`, `lotNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `stock_movements_lotId_idx` ON `stock_movements`(`lotId`);

-- CreateIndex
CREATE INDEX `stock_position_balances_lotId_idx` ON `stock_position_balances`(`lotId`);

-- CreateIndex
CREATE UNIQUE INDEX `stock_position_balances_productId_storagePositionId_lotId_key` ON `stock_position_balances`(`productId`, `storagePositionId`, `lotId`);

-- DropIndex (so agora - ver a nota de ORDEM DAS OPERACOES no topo)
DROP INDEX `stock_position_balances_productId_storagePositionId_key` ON `stock_position_balances`;

-- CreateIndex
CREATE INDEX `warehouse_tasks_lotId_idx` ON `warehouse_tasks`(`lotId`);

-- AddForeignKey
ALTER TABLE `lots` ADD CONSTRAINT `lots_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lots` ADD CONSTRAINT `lots_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `suppliers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_position_balances` ADD CONSTRAINT `stock_position_balances_lotId_fkey` FOREIGN KEY (`lotId`) REFERENCES `lots`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_lotId_fkey` FOREIGN KEY (`lotId`) REFERENCES `lots`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `warehouse_tasks` ADD CONSTRAINT `warehouse_tasks_lotId_fkey` FOREIGN KEY (`lotId`) REFERENCES `lots`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

