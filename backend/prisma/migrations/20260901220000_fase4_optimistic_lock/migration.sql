-- Fase 4 do cronograma, item 4.2: campo version (lock otimista) em
-- ProductionOrder, ProductionOrderOperation, PurchaseOrderItem,
-- CountingSession e CountingItem. Complementa os locks pessimistas
-- (SELECT ... FOR UPDATE) ja adicionados nas Fases 1/3 para as race
-- conditions especificas ja encontradas - este cobre o caso geral de
-- "lost update" quando um cliente edita com base em dados desatualizados.

-- AlterTable
ALTER TABLE `counting_items` ADD COLUMN `version` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `counting_sessions` ADD COLUMN `version` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `production_order_operations` ADD COLUMN `version` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `production_orders` ADD COLUMN `version` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `purchase_order_items` ADD COLUMN `version` INTEGER NOT NULL DEFAULT 0;

