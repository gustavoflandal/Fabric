-- Fase 2 do plano do WMS - Movimentacao rastreada e transferencia interna
-- (docs/fase-2026-09-modernizacao/WMS_IMPLEMENTATION_ANALYSIS.md, secao 5).
--
-- Cobre:
--   F2.2  `stock_movements.type`: VARCHAR livre -> ENUM('IN','OUT','ADJUSTMENT','TRANSFER').
--   F2.1  `stock_movements.positionId` (campo unico da Fase 1) -> par
--         `fromPositionId` / `toPositionId`, COM REAPROVEITAMENTO dos valores
--         ja gravados (nao e um rename simples: para qual das duas colunas o
--         valor vai depende do `type` da linha).
--
-- ORDEM DOS PASSOS (importa): o ENUM e convertido ANTES do backfill porque o
-- backfill filtra por `type`; e o DROP de `positionId` vem por ultimo, depois
-- de os valores estarem copiados e conferidos.

-- ============================================================
-- F2.2 - `type` vira ENUM
-- ============================================================
-- Conversao DIRETA, sem ambiguidade: hoje a coluna so contem 'IN', 'OUT' e
-- 'ADJUSTMENT' - os tres unicos valores que stock.service.ts::applyMovement()
-- jamais escreveu (nao ha outro ponto de escrita em stock_movements no
-- backend). Se alguma linha tivesse qualquer outro valor, este ALTER falharia
-- em vez de truncar silenciosamente, porque o MySQL em STRICT mode (default
-- desde a 5.7) recusa o valor invalido. Falhar aqui e o comportamento
-- desejado: e uma migration de dados, nao um cast best-effort.
--
-- `TRANSFER` entra no enum agora, ainda sem nenhuma linha - passa a ser
-- escrito por stock.service.ts::transfer() (F2.3).
--
-- O indice `stock_movements_type_idx` sobrevive ao MODIFY (o MySQL o
-- reconstroi junto), entao nao e recriado aqui.
ALTER TABLE `stock_movements`
    MODIFY `type` ENUM('IN', 'OUT', 'ADJUSTMENT', 'TRANSFER') NOT NULL;

-- ============================================================
-- F2.1 - `positionId` -> `fromPositionId` / `toPositionId`
-- ============================================================

-- AlterTable
ALTER TABLE `stock_movements` ADD COLUMN `fromPositionId` VARCHAR(191) NULL;
ALTER TABLE `stock_movements` ADD COLUMN `toPositionId` VARCHAR(191) NULL;

-- ------------------------------------------------------------
-- BACKFILL - reaproveita o endereco ja gravado (F1.2)
-- ------------------------------------------------------------
-- A regra e a que o comentario de `positionId` no schema da Fase 1 registrou:
--
--   IN         -> toPositionId    (a quantidade ENTROU naquele endereco)
--   OUT        -> fromPositionId  (a quantidade SAIU daquele endereco)
--   ADJUSTMENT -> toPositionId    (ver a justificativa do sinal abaixo)
--
-- Sobre o "conforme o sinal" do ADJUSTMENT: `quantity` e sempre POSITIVA nesta
-- tabela (o sinal mora no `type`), e applyMovement() sempre tratou ADJUSTMENT
-- como delta POSITIVO (`delta = type === 'OUT' ? -quantity : quantity`). Ou
-- seja: uma linha ADJUSTMENT enderecada CREDITOU a posicao, e o destino
-- (`toPositionId`) e a unica leitura coerente com o saldo que ela ja produziu.
-- Na pratica nao ha nenhuma linha assim: os ajustes do sistema (adjustStock,
-- registerAdjustment, ajuste pos-contagem) sao gravados como IN ou OUT com
-- `referenceType = 'ADJUSTMENT'`, nunca com `type = 'ADJUSTMENT'`. O UPDATE
-- fica mesmo assim, para que a migration seja correta tambem numa base que
-- tenha linhas legadas fora desse padrao.
--
-- Nenhum WHERE precisa testar `positionId IS NOT NULL`: copiar NULL para NULL
-- e inocuo, e o filtro por `type` ja restringe o conjunto.
UPDATE `stock_movements` SET `toPositionId`   = `positionId` WHERE `type` = 'IN';
UPDATE `stock_movements` SET `fromPositionId` = `positionId` WHERE `type` = 'OUT';
UPDATE `stock_movements` SET `toPositionId`   = `positionId` WHERE `type` = 'ADJUSTMENT';

-- ------------------------------------------------------------
-- Remocao da coluna antiga
-- ------------------------------------------------------------
-- A FK precisa cair ANTES do indice: no MySQL, `stock_movements_positionId_idx`
-- e o indice que da suporte a FK, e o DROP INDEX e recusado enquanto a
-- constraint existir.

-- DropForeignKey
ALTER TABLE `stock_movements` DROP FOREIGN KEY `stock_movements_positionId_fkey`;

-- DropIndex
DROP INDEX `stock_movements_positionId_idx` ON `stock_movements`;

-- AlterTable
ALTER TABLE `stock_movements` DROP COLUMN `positionId`;

-- ------------------------------------------------------------
-- Indices e FKs do par novo
-- ------------------------------------------------------------
-- Dois indices de coluna unica (e nao um composto): o historico por posicao
-- (F2.4) pergunta "esta posicao foi origem OU destino" - um OR, que o MySQL
-- resolve por index merge dos dois. Um composto (fromPositionId, toPositionId)
-- nao cobriria a segunda metade da condicao.

-- CreateIndex
CREATE INDEX `stock_movements_fromPositionId_idx` ON `stock_movements`(`fromPositionId`);

-- CreateIndex
CREATE INDEX `stock_movements_toPositionId_idx` ON `stock_movements`(`toPositionId`);

-- AddForeignKey
-- RESTRICT EXPLICITO nos dois lados, exatamente como era em `positionId`: o
-- default do Prisma para relacao opcional seria SET NULL, que apagaria
-- silenciosamente o endereco de um movimento historico. Trilha de auditoria
-- nao se reescreve; para aposentar um endereco em uso, `blocked = true`.
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_fromPositionId_fkey` FOREIGN KEY (`fromPositionId`) REFERENCES `storage_positions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_toPositionId_fkey` FOREIGN KEY (`toPositionId`) REFERENCES `storage_positions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
