-- Fase 4b do plano do WMS - Regras de armazenagem, picking e reposicao
-- (docs/fase-2026-09-modernizacao/WMS_IMPLEMENTATION_ANALYSIS.md, secao 5,
--  itens F4.6 a F4.11; secao 3.4 de 04_ARQUITETURA_MODULAR_LICENCIAMENTO.md).
--
-- Cobre:
--   F4.6  - `storage_rules` (regra de sugestao de endereco por produto OU
--           categoria, com prioridade, e o sinal que decide se a etapa de
--           QUARENTENA e necessaria - o `// TODO Fase 4b` da Fase 4a).
--   F4.7  - `document_sequences` (numeracao atomica de documento, substituindo
--           o `count() + 1` de `receiptNumber` e `orderNumber`).
--   F4.8  - `WarehouseTaskType` ganha `PICKING`.
--   F4.10 - `WarehouseTaskType` ganha `REPLENISHMENT` e `storage_positions`
--           ganha `isPickingArea` (a distincao picking x pulmao, que nao
--           existia no schema).
--
-- PURAMENTE ADITIVA, nos tres sentidos que importam:
--   * duas tabelas NOVAS;
--   * uma coluna nova com DEFAULT false - toda posicao existente continua
--     valendo exatamente o que valia (nenhuma vira area de picking por
--     acidente, e o detector de reposicao simplesmente nao encontra candidata
--     ate alguem marcar a primeira);
--   * dois valores NOVOS no fim do ENUM de tipo de tarefa. Acrescentar valor
--     no FIM de um ENUM do MySQL nao reescreve a tabela nem renumera os valores
--     existentes (os indices ordinais de DESCARGA..ALOCACAO nao mudam), entao o
--     MODIFY abaixo e uma alteracao de metadados, nao um rebuild de
--     `warehouse_tasks`.
--
-- Nenhuma linha de dado e tocada. Uma instalacao sem WMS licenciado nunca
-- escreve em `storage_rules` nem gera tarefa de PICKING/REPLENISHMENT;
-- `document_sequences`, ao contrario das outras, e usada nos DOIS modos (a
-- numeracao de documento nao e uma funcionalidade do WMS - e a correcao de um
-- bug de concorrencia que sempre existiu no nucleo de compras).

-- AlterTable
ALTER TABLE `storage_positions` ADD COLUMN `isPickingArea` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `warehouse_tasks` MODIFY `type` ENUM('DESCARGA', 'CONFERENCIA', 'ETIQUETAGEM', 'QUARENTENA', 'ALOCACAO', 'PICKING', 'REPLENISHMENT') NOT NULL;

-- CreateTable
CREATE TABLE `storage_rules` (
    `id` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NULL,
    `categoryId` VARCHAR(191) NULL,
    `positionType` ENUM('PORTA_PALETES', 'MINI_PORTA_PALETES', 'DRIVE_IN', 'DRIVE_THROUGH', 'PUSH_BACK', 'FLOW_RACK', 'CANTILEVER', 'MEZANINO', 'AUTOPORTANTE', 'RACKS', 'CARROSSEL', 'MINI_LOAD', 'ESTANTES_INDUSTRIAIS', 'PISO', 'DOCA', 'QUARENTENA', 'BLOQUEIO', 'EXPEDICAO') NULL,
    `priority` INTEGER NOT NULL DEFAULT 0,
    `requiresQuarantine` BOOLEAN NOT NULL DEFAULT false,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `storage_rules_productId_active_priority_idx`(`productId`, `active`, `priority`),
    INDEX `storage_rules_categoryId_active_priority_idx`(`categoryId`, `active`, `priority`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
-- A invariante "productId XOR categoryId" NAO vira CHECK constraint aqui: o
-- Prisma 5 nao modela CHECK, e uma constraint presente no banco e ausente do
-- `schema.prisma` e justamente o que faz um `prisma migrate dev` futuro
-- reportar drift. A garantia mora em `storage-rule.service.ts` + validator Joi,
-- mesmo criterio ja adotado para `SUM(putaway) <= acceptedQty` (garantida por
-- lock) e para a obrigatoriedade condicional de dimensao por tipo de posicao.
CREATE TABLE `document_sequences` (
    `code` VARCHAR(191) NOT NULL,
    `nextValue` INTEGER NOT NULL DEFAULT 1,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `storage_positions_isPickingArea_blocked_idx` ON `storage_positions`(`isPickingArea`, `blocked`);

-- AddForeignKey
-- RESTRICT explicito nas duas FKs OPCIONAIS: o default do Prisma para relacao
-- opcional e SET NULL, que transformaria uma regra de produto/categoria numa
-- regra sem escopo em vez de barrar a exclusao. Mesmo padrao ja estabelecido em
-- `stock_movements`, `counting_items` e `warehouse_tasks`.
ALTER TABLE `storage_rules` ADD CONSTRAINT `storage_rules_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `storage_rules` ADD CONSTRAINT `storage_rules_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `product_categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
