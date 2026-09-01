-- Fase 4 do cronograma, item 4.5: FKs de integridade referencial para os
-- campos de auditoria createdBy/approvedBy/receivedBy, que ate agora eram
-- String solta sem nenhuma checagem contra a tabela users. Verificado antes
-- de escrever esta migration: zero linhas orfas em qualquer uma das 4
-- tabelas (ver commit) - seguro adicionar as FKs diretamente, sem
-- necessidade de limpar dados primeiro.

-- CreateIndex
CREATE INDEX `production_orders_createdBy_idx` ON `production_orders`(`createdBy`);

-- CreateIndex
CREATE INDEX `purchase_orders_createdBy_idx` ON `purchase_orders`(`createdBy`);

-- CreateIndex
CREATE INDEX `purchase_quotations_createdBy_idx` ON `purchase_quotations`(`createdBy`);

-- CreateIndex
CREATE INDEX `purchase_receipts_receivedBy_idx` ON `purchase_receipts`(`receivedBy`);

-- AddForeignKey
ALTER TABLE `production_orders` ADD CONSTRAINT `production_orders_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_quotations` ADD CONSTRAINT `purchase_quotations_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_quotations` ADD CONSTRAINT `purchase_quotations_approvedBy_fkey` FOREIGN KEY (`approvedBy`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_orders` ADD CONSTRAINT `purchase_orders_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_orders` ADD CONSTRAINT `purchase_orders_approvedBy_fkey` FOREIGN KEY (`approvedBy`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_receipts` ADD CONSTRAINT `purchase_receipts_receivedBy_fkey` FOREIGN KEY (`receivedBy`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

