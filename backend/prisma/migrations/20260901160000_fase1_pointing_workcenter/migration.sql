-- Fase 1 do cronograma (item 1.5): corrige o modulo de apontamentos de
-- producao, que estava totalmente inoperante (POST /production-pointings
-- retornava 500 - "Argument runTime is missing" - em qualquer chamada).
--
-- production-pointing.validator.ts sempre exigiu workCenterId no payload,
-- ProductionPointingService.getAll() sempre filtrou por
-- `where.workCenterId`, e o service sempre tentou incluir `workCenter` na
-- resposta - mas o model ProductionPointing nunca teve essa coluna/relacao
-- no schema (drift). Tabela vazia (0 linhas) em todos os ambientes
-- conhecidos ate agora - nao ha dado existente para migrar.

-- AlterTable
ALTER TABLE `production_pointings` ADD COLUMN `workCenterId` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE INDEX `production_pointings_workCenterId_idx` ON `production_pointings`(`workCenterId`);

-- AddForeignKey
ALTER TABLE `production_pointings` ADD CONSTRAINT `production_pointings_workCenterId_fkey` FOREIGN KEY (`workCenterId`) REFERENCES `work_centers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
