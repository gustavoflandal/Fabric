-- Fase 0 do plano do WMS
-- (docs/fase-2026-09-modernizacao/WMS_IMPLEMENTATION_ANALYSIS.md, secao 5).
--
-- Cobre, numa unica migration:
--   F0.1  storage_positions.code persistido (formato ARM-RUA-AA-PP) + backfill
--         das posicoes existentes + indice unico.
--   F0.3  PositionType estendido com os tipos de AREA (PISO, DOCA, QUARENTENA,
--         BLOQUEIO, EXPEDICAO) e campos dimensionais de warehouse_structures /
--         storage_positions passando a NULL (area nao tem paletizacao). A
--         obrigatoriedade por tipo de rack fica nos validators, nao no banco,
--         porque e condicional.
--   F0.4  DROP da coluna storage_positions.occupied e do seu indice (decisao D3:
--         flag denormalizada que nenhum codigo jamais escreveu; ocupacao passa a
--         ser derivada do saldo por posicao na Fase 1).
--   F0.8  Tabela licensed_modules (licenciamento de modulo por instalacao, secao
--         3.1 de 04_ARQUITETURA_MODULAR_LICENCIAMENTO.md).
--   F0.9  Colunas opcionais de armazenagem em products (puramente aditivo,
--         zero impacto em instalacao so-PCP).

-- ============================================================
-- F0.4 - remocao de storage_positions.occupied
-- ============================================================

-- DropIndex
DROP INDEX `storage_positions_occupied_idx` ON `storage_positions`;

-- ============================================================
-- F0.9 - dados de armazenagem no produto (aditivo, tudo nullable)
-- ============================================================

-- AlterTable
ALTER TABLE `products` ADD COLUMN `depth` DOUBLE NULL,
    ADD COLUMN `height` DOUBLE NULL,
    ADD COLUMN `maxStackQty` INTEGER NULL,
    ADD COLUMN `packagingType` VARCHAR(191) NULL,
    ADD COLUMN `segregationGroup` VARCHAR(191) NULL,
    ADD COLUMN `volume` DOUBLE NULL,
    ADD COLUMN `weight` DOUBLE NULL,
    ADD COLUMN `width` DOUBLE NULL;

-- ============================================================
-- F0.1 / F0.3 / F0.4 - storage_positions
-- ============================================================
-- `code` entra em tres passos porque a tabela ja tem linhas em producao e a
-- coluna e NOT NULL UNIQUE: adiciona NULL -> backfill -> promove a NOT NULL.
-- Adicionar direto como NOT NULL preencheria todas as linhas com string vazia e
-- estouraria o indice unico na segunda posicao.

-- AlterTable
ALTER TABLE `storage_positions` DROP COLUMN `occupied`,
    ADD COLUMN `code` VARCHAR(191) NULL,
    MODIFY `positionType` ENUM('PORTA_PALETES', 'MINI_PORTA_PALETES', 'DRIVE_IN', 'DRIVE_THROUGH', 'PUSH_BACK', 'FLOW_RACK', 'CANTILEVER', 'MEZANINO', 'AUTOPORTANTE', 'RACKS', 'CARROSSEL', 'MINI_LOAD', 'ESTANTES_INDUSTRIAIS', 'PISO', 'DOCA', 'QUARENTENA', 'BLOQUEIO', 'EXPEDICAO') NOT NULL,
    MODIFY `weightCapacity` DOUBLE NULL,
    MODIFY `height` DOUBLE NULL,
    MODIFY `width` DOUBLE NULL,
    MODIFY `depth` DOUBLE NULL,
    MODIFY `maxHeight` DOUBLE NULL;

-- Backfill: mesmo formato que getPositionsByStructure() concatenava em memoria
-- (`${warehouseCode}-${streetCode}-${floor:2}-${position:2}`).
--
-- O GREATEST(2, CHAR_LENGTH(...)) NAO e decoracao: LPAD do MySQL TRUNCA quando o
-- valor e mais longo que o comprimento pedido - LPAD(125, 2, '0') devolve '12',
-- nao '125'. String.padStart() do JS nunca trunca. Sem isso, uma rua com mais de
-- 99 posicoes geraria codigos divergentes da regra de buildPositionCode() e,
-- pior, colisoes silenciosas no indice unico (posicao 12 e posicao 125 viram
-- ambas '-12').
UPDATE `storage_positions`
SET `code` = CONCAT(
        `warehouseCode`, '-',
        `streetCode`, '-',
        LPAD(`floor`, GREATEST(2, CHAR_LENGTH(`floor`)), '0'), '-',
        LPAD(`position`, GREATEST(2, CHAR_LENGTH(`position`)), '0')
    )
WHERE `code` IS NULL;

-- AlterTable
ALTER TABLE `storage_positions` MODIFY `code` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `storage_positions_code_key` ON `storage_positions`(`code`);

-- ============================================================
-- F0.3 - warehouse_structures
-- ============================================================

-- AlterTable
ALTER TABLE `warehouse_structures` MODIFY `weightCapacity` DOUBLE NULL,
    MODIFY `height` DOUBLE NULL,
    MODIFY `width` DOUBLE NULL,
    MODIFY `depth` DOUBLE NULL,
    MODIFY `maxHeight` DOUBLE NULL,
    MODIFY `positionType` ENUM('PORTA_PALETES', 'MINI_PORTA_PALETES', 'DRIVE_IN', 'DRIVE_THROUGH', 'PUSH_BACK', 'FLOW_RACK', 'CANTILEVER', 'MEZANINO', 'AUTOPORTANTE', 'RACKS', 'CARROSSEL', 'MINI_LOAD', 'ESTANTES_INDUSTRIAIS', 'PISO', 'DOCA', 'QUARENTENA', 'BLOQUEIO', 'EXPEDICAO') NOT NULL;

-- ============================================================
-- F0.8 - licenciamento de modulo por instalacao
-- ============================================================

-- CreateTable
CREATE TABLE `licensed_modules` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `licensed_modules_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
