-- `notes` de PEDIDO DE VENDA e ROMANEIO passa de VARCHAR(191) para TEXT.
--
-- O default do Prisma para `String?` em MySQL e VARCHAR(191), mas os validators
-- (`sales-order.validator.ts` / `shipment.validator.ts`) aceitam ate 500
-- caracteres. Uma observacao de 192 a 500 caracteres passava na validacao e
-- estourava no INSERT (MySQL 1406 "Data too long for column") como 500 Internal
-- Server Error — numa entrada que o proprio servidor tinha acabado de declarar
-- valida. TEXT e o mesmo tipo ja usado por `PurchaseOrder.notes`.
--
-- Migration ADITIVA sobre 20260913185835_add_expedicao_pedidos_venda (que nao
-- foi editada): alargar a coluna nao perde dado nem exige backfill.

-- AlterTable
ALTER TABLE `sales_orders` MODIFY `notes` TEXT NULL;

-- AlterTable
ALTER TABLE `shipments` MODIFY `notes` TEXT NULL;
