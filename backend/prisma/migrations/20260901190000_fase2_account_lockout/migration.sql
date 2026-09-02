-- Fase 2 do cronograma, item 2.4: bloqueio de conta por tentativas de login
-- falhas (antes so havia rate limit por IP, nao por conta).

ALTER TABLE `users` ADD COLUMN `failedLoginAttempts` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `lockedUntil` DATETIME(3) NULL;
