-- backend/scripts/sql/create-readonly-user.sql
--
-- Usuário MySQL dedicado ao assistente de IA — GRANT SELECT apenas, sem
-- DDL/DML, nas 7 tabelas que as 3 funções de consulta (Task 2) realmente
-- leem. Rodar manualmente contra o banco de dev e o de teste (não é uma
-- migration Prisma: criação de usuário/GRANT não é mudança de schema).
--
-- Uso (dev):  mysql -u root -p fabric      < backend/scripts/sql/create-readonly-user.sql
-- Uso (test): mysql -u root -p fabric_test < backend/scripts/sql/create-readonly-user.sql
-- (trocar a senha abaixo antes de rodar em qualquer ambiente real — dev ou
-- produção. O valor `assistente_test_only_ephemeral` abaixo segue a mesma
-- convenção já usada no restante deste projeto para o banco de TESTE efêmero
-- em tmpfs, docker-compose.test.yml/.env.test: nunca aponta para um banco
-- real, por isso pode ficar versionado. Rodando contra `fabric` de dev/prod,
-- troque por uma senha forte e única antes de executar).
--
-- Tabelas SEM prefixo de schema de propósito: o nome do banco de dev
-- (`fabric`) e o de teste (`fabric_test`) são diferentes, e um GRANT sem
-- qualificação de schema (`tbl_name`, não `db.tbl_name`) aplica ao banco
-- default da conexão — exatamente o argumento passado ao `mysql` acima. Isso
-- é o que permite este único script rodar sem alteração contra os dois
-- bancos, como o comentário acima já promete.

-- Atenção: `CREATE USER IF NOT EXISTS` NÃO atualiza a senha de um usuário que
-- já existe (o `IDENTIFIED BY` é ignorado nesse caso). Se este script já foi
-- rodado antes contra um ambiente e a senha precisa mudar, rode manualmente
-- `ALTER USER 'fabric_assistente'@'%' IDENTIFIED BY '<nova_senha>';` ou
-- `DROP USER 'fabric_assistente'@'%';` antes de rodar este script de novo.
CREATE USER IF NOT EXISTS 'fabric_assistente'@'%' IDENTIFIED BY 'assistente_test_only_ephemeral';

GRANT SELECT ON stock_balances TO 'fabric_assistente'@'%';
GRANT SELECT ON stock_position_balances TO 'fabric_assistente'@'%';
GRANT SELECT ON stock_movements TO 'fabric_assistente'@'%';
GRANT SELECT ON products TO 'fabric_assistente'@'%';
GRANT SELECT ON product_categories TO 'fabric_assistente'@'%';
GRANT SELECT ON warehouses TO 'fabric_assistente'@'%';
GRANT SELECT ON storage_positions TO 'fabric_assistente'@'%';

FLUSH PRIVILEGES;
