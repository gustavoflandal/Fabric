-- Fase 3 do plano do WMS - Contagem por endereco
-- (docs/fase-2026-09-modernizacao/WMS_IMPLEMENTATION_ANALYSIS.md, secao 5).
--
-- Cobre o item F3.1 inteiro:
--   a) `counting_items.locationId` -> `counting_items.storagePositionId`
--      (FK para `storage_positions`, ON DELETE RESTRICT).
--   b) unique `(sessionId, productId, locationId)` -> `(sessionId, productId,
--      storagePositionId)`.
--   c) DROP da tabela `locations` e, com ela, do enum `LocationType` (que no
--      MySQL existia apenas como o tipo inline da coluna `locations.type`).
--
-- PRE-CONDICAO VERIFICADA ANTES DE ESCREVER ESTA MIGRATION:
--   SELECT COUNT(*), COUNT(locationId) FROM counting_items;  -> 0, 0
--   SELECT COUNT(*) FROM locations;                          -> 0
-- nos DOIS bancos (desenvolvimento e o de teste efemero). `locationId` nunca
-- foi escrito por codigo de aplicacao - nao ha service, controller nem rota que
-- toque em `Location`. Por isso o CHANGE COLUMN abaixo NAO precisa de backfill
-- nem de mapeamento de valores: ele apenas renomeia uma coluna comprovadamente
-- vazia. Se em alguma instalacao a coluna tivesse valor, a migration falharia no
-- ADD CONSTRAINT (os ids seriam de `locations`, nao de `storage_positions`) -
-- falhar e o comportamento desejado, e nao converter dado a esmo.

-- ============================================================
-- F3.1.a - remocao das amarras da coluna antiga
-- ============================================================
-- Ordem OBRIGATORIA: a FK cai antes do indice que a suporta. No MySQL,
-- `counting_items_locationId_fkey` e ao mesmo tempo o nome da constraint e o do
-- indice criado automaticamente para ela, e o DROP INDEX e recusado enquanto a
-- constraint existir.

-- DropForeignKey
ALTER TABLE `counting_items` DROP FOREIGN KEY `counting_items_locationId_fkey`;

-- DropIndex
DROP INDEX `counting_items_locationId_fkey` ON `counting_items`;

-- DropIndex
DROP INDEX `counting_items_sessionId_productId_locationId_key` ON `counting_items`;

-- ============================================================
-- F3.1.a - a coluna em si
-- ============================================================
-- CHANGE COLUMN (rename) em vez de DROP + ADD: o tipo e a nulidade sao os
-- mesmos, e renomear deixa explicito no historico que esta e A MESMA dimensao
-- de endereco do item de contagem, agora apontando para a arvore certa - nao
-- uma coluna nova que por acaso apareceu quando outra sumiu.

-- AlterTable
ALTER TABLE `counting_items` CHANGE COLUMN `locationId` `storagePositionId` VARCHAR(191) NULL;

-- ============================================================
-- F3.1.b - indices e FK da coluna nova
-- ============================================================
-- O indice dedicado por `storagePositionId` e declarado explicitamente no
-- schema: ele NAO e redundante com o unique abaixo, porque la a coluna e a
-- TERCEIRA (nenhum prefixo do composto responde "quais contagens tocaram neste
-- endereco?"). Ele tambem serve de indice de suporte da FK, entao o MySQL nao
-- cria um `_fkey` extra.

-- CreateIndex
CREATE INDEX `counting_items_storagePositionId_idx` ON `counting_items`(`storagePositionId`);

-- CreateIndex
-- Semantica preservada do unique antigo: no MySQL NULLs sao DISTINTOS num
-- indice unico, entao varias linhas (sessao, produto, NULL) continuam
-- permitidas - exatamente como antes. O que a constraint garante e o caso novo:
-- com WMS licenciado, a mesma sessao nao pode gerar dois itens para o mesmo
-- par produto x endereco.
CREATE UNIQUE INDEX `counting_items_sessionId_productId_storagePositionId_key` ON `counting_items`(`sessionId`, `productId`, `storagePositionId`);

-- AddForeignKey
-- RESTRICT EXPLICITO (o default do Prisma para relacao opcional seria SET NULL):
-- item de contagem e registro historico de inventario, e apagar um endereco nao
-- pode zerar silenciosamente ONDE a contagem aconteceu. Mesmo motivo, e mesmo
-- comportamento, de `stock_movements.fromPositionId`/`toPositionId` (F2.1).
ALTER TABLE `counting_items` ADD CONSTRAINT `counting_items_storagePositionId_fkey` FOREIGN KEY (`storagePositionId`) REFERENCES `storage_positions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- F3.1.c - DROP de `locations` (conclusao da decisao 4.1)
-- ============================================================
-- Ultimo passo de proposito: so e seguro depois que a unica FK que apontava
-- para ca (`counting_items.locationId`) deixou de existir.
--
-- A auto-referencia `locations.parentId -> locations.id` cai junto com a tabela;
-- nao existe nenhuma outra tabela referenciando `locations` (verificado em
-- information_schema.KEY_COLUMN_USAGE). O enum `LocationType` nao precisa de
-- DDL propria: no MySQL ele era o tipo inline da coluna `locations.type`, entao
-- desaparece com a tabela.

-- DropTable
DROP TABLE `locations`;
