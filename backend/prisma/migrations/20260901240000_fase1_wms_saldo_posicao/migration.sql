-- Fase 1 do plano do WMS - Saldo por posicao
-- (docs/fase-2026-09-modernizacao/WMS_IMPLEMENTATION_ANALYSIS.md, secao 5).
--
-- Cobre:
--   F1.1  Tabela `stock_position_balances` (saldo por PRODUTO x POSICAO), o
--         nucleo do WMS. Decisao D1: o agregado `stock_balances` PERMANECE e
--         vira roll-up mantido na mesma transacao. Decisao D2: `quantity` nasce
--         DECIMAL(18,4), nao DOUBLE.
--   F1.2  Coluna `stock_movements.positionId` (posicao envolvida na
--         movimentacao). NULL = movimentacao nao enderecada, que e 100% do
--         fluxo atual e continua funcionando identicamente.
--
-- Migration PURAMENTE ADITIVA: nenhuma coluna existente muda de tipo ou de
-- nulabilidade, nenhum dado e reescrito. Uma instalacao so-PCP ganha uma tabela
-- vazia e uma coluna sempre NULL - zero impacto.
--
-- NENHUMA FK USA ON DELETE CASCADE, de proposito:
--   * `stock_position_balances` -> products / storage_positions: RESTRICT.
--     Perder saldo por delecao em cascata seria um bug grave e silencioso. A
--     exclusao de produto/posicao com saldo passa a ser BARRADA (que e o
--     comportamento desejado); zere o saldo antes.
--   * `stock_movements.positionId` -> storage_positions: RESTRICT EXPLICITO. O
--     default do Prisma para relacao opcional seria SET NULL, que apagaria
--     silenciosamente o endereco de um movimento historico - trilha de
--     auditoria nao pode ser reescrita. Para aposentar um endereco em uso, use
--     `blocked = true`, nao DELETE.
--
-- Efeito colateral consciente: `storage_positions.structureId` tem ON DELETE
-- CASCADE (estrutura -> posicoes, vindo da Fase 0). Com as FKs acima no
-- caminho, apagar uma ESTRUTURA que tenha posicoes com saldo ou com historico
-- de movimentacao passa a falhar por FK. storage-position.service.ts /
-- warehouse-structure.service.ts traduzem isso em AppError legivel.
--
-- EVOLUCAO PLANEJADA (F2.1, Fase 2 - transferencia interna): `positionId` sera
-- desdobrado em `fromPositionId`/`toPositionId` quando o tipo TRANSFER for
-- introduzido. A migration dessa fase deve REAPROVEITAR os valores gravados
-- aqui (IN -> toPositionId, OUT -> fromPositionId, ADJUSTMENT -> conforme o
-- sinal), nao descarta-los.

-- ============================================================
-- F1.2 - posicao na movimentacao
-- ============================================================

-- AlterTable
ALTER TABLE `stock_movements` ADD COLUMN `positionId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `stock_movements_positionId_idx` ON `stock_movements`(`positionId`);

-- ============================================================
-- F1.1 - saldo por produto x posicao
-- ============================================================
-- Sem indice dedicado por `productId`: o unico composto abaixo ja o atende
-- (coluna mais a esquerda no InnoDB). Um segundo indice com o mesmo prefixo so
-- adicionaria custo de escrita numa tabela escrita a cada movimentacao.

-- CreateTable
CREATE TABLE `stock_position_balances` (
    `id` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `storagePositionId` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `version` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `stock_position_balances_storagePositionId_idx`(`storagePositionId`),
    UNIQUE INDEX `stock_position_balances_productId_storagePositionId_key`(`productId`, `storagePositionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================
-- Chaves estrangeiras (todas RESTRICT - ver cabecalho)
-- ============================================================

-- AddForeignKey
ALTER TABLE `stock_position_balances` ADD CONSTRAINT `stock_position_balances_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_position_balances` ADD CONSTRAINT `stock_position_balances_storagePositionId_fkey` FOREIGN KEY (`storagePositionId`) REFERENCES `storage_positions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_positionId_fkey` FOREIGN KEY (`positionId`) REFERENCES `storage_positions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
