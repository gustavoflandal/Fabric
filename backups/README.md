# 🗄️ Backups do Sistema Fabric MES

Esta pasta contém os backups do banco de dados do sistema Fabric MES.

## 📋 Como Fazer Backup

### Método 1: Via NPM Script (Recomendado)
```bash
cd backend
npm run backup
```

### Método 2: Via Node Diretamente
```bash
cd backend
node backup-database.js
```

## 📊 Formato do Backup

Os backups são salvos em formato **JSON** com a seguinte estrutura:

```json
{
  "timestamp": "2025-10-20T18:07:02.463Z",
  "database": "fabric",
  "version": "1.0.0",
  "tables": {
    "users": [...],
    "products": [...],
    "productionOrders": [...],
    ...
  }
}
```

## 📁 Tabelas Incluídas no Backup

- ✅ **Usuários** (users)
- ✅ **Perfis** (roles)
- ✅ **Permissões** (permissions)
- ✅ **Unidades de Medida** (unitOfMeasures)
- ✅ **Categorias de Produto** (productCategories)
- ✅ **Produtos** (products)
- ✅ **BOMs** (boms)
- ✅ **Itens de BOM** (bomItems)
- ✅ **Roteiros** (routings)
- ✅ **Operações de Roteiro** (routingOperations)
- ✅ **Centros de Trabalho** (workCenters)
- ✅ **Fornecedores** (suppliers)
- ✅ **Clientes** (customers)
- ✅ **Ordens de Produção** (productionOrders)
- ✅ **Operações de Ordem** (productionOrderOperations)
- ✅ **Apontamentos de Produção** (productionPointings)
- ✅ **Movimentações de Estoque** (stockMovements)
- ✅ **Logs de Auditoria** (auditLogs)

## 🔄 Como Restaurar um Backup

### ⚠️ ATENÇÃO: Leia Antes de Restaurar!

**A restauração irá DELETAR TODOS os dados atuais do banco de dados!**

Certifique-se de:
- ✅ Fazer um backup dos dados atuais antes de restaurar
- ✅ Ter certeza de qual backup deseja restaurar
- ✅ Parar o servidor antes de restaurar (recomendado)

### Método 1: Via NPM Script (Recomendado)

```bash
cd backend

# Listar backups disponíveis
npm run restore

# Restaurar um backup específico
npm run restore ../backups/fabric_backup_2025-10-20T18-07-02-463Z.json
```

### Método 2: Via Node Diretamente

```bash
cd backend

# Listar backups disponíveis
node restore-database.js

# Restaurar um backup específico
node restore-database.js ../backups/fabric_backup_2025-10-20T18-07-02-463Z.json
```

### 📋 Processo de Restauração

O script executará os seguintes passos:

1. **Validação**: Verifica se o arquivo de backup existe
2. **Informações**: Mostra dados do backup (data, versão, registros)
3. **Confirmação**: Aguarda 3 segundos (Ctrl+C para cancelar)
4. **Limpeza**: Deleta todos os dados atuais (respeitando FKs)
5. **Restauração**: Importa dados do backup na ordem correta
6. **Conclusão**: Confirma sucesso da operação

### ⏱️ Tempo Estimado

- Backup pequeno (~0.3 MB): 10-30 segundos
- Backup médio (~1 MB): 30-60 segundos
- Backup grande (~5 MB): 1-3 minutos

### 🔍 Exemplo de Uso

```bash
cd backend
npm run restore

# Saída:
# 📋 Uso: node restore-database.js <arquivo-backup>
# 
# Exemplo: node restore-database.js ../backups/fabric_backup_2025-10-20T18-07-02-463Z.json
# 
# 📋 Backups disponíveis:
#    1. fabric_backup_2025-10-20T18-07-02-463Z.json
#       0.32 MB - 20/10/2025, 15:07:02

# Restaurar o backup mais recente:
npm run restore ../backups/fabric_backup_2025-10-20T18-07-02-463Z.json
```

### ✅ Após a Restauração

1. **Reinicie o servidor** se estava rodando
2. **Faça login** com as credenciais do backup
3. **Verifique os dados** no sistema
4. **Teste funcionalidades** críticas

### 🔐 Credenciais Padrão (Backup de Teste)

Se restaurar um backup de teste, use:
- **Email**: admin@fabric.com
- **Senha**: admin123

## 📝 Convenção de Nomes

Os arquivos de backup seguem o padrão:
```
fabric_backup_YYYY-MM-DDTHH-MM-SS-MMMZ.json
```

Exemplo: `fabric_backup_2025-10-20T18-07-02-463Z.json`

## 💾 Tamanho Médio

- Backup completo: ~0.3 MB (com dados de teste)
- Backup em produção: Variável conforme volume de dados

## ⚠️ Importante

- Faça backups regularmente (recomendado: diariamente)
- Mantenha pelo menos os últimos 7 backups
- Armazene backups em local seguro (considere backup externo)
- Teste a restauração periodicamente

## 🔐 Segurança

- Os backups contêm dados sensíveis (senhas hasheadas, dados de produção)
- **NÃO** commite backups no Git (já está no .gitignore)
- Mantenha os backups em local seguro
- Considere criptografar backups para produção

## 📅 Histórico

- **2025-10-20**: Primeiro backup criado com 575 registros totais

Para fazer o backup completo do banco de dados do fabric.
PS E:\> docker exec 3080828256ed0215942b17fb379c03327f072503b661043601700180416273d1 /usr/bin/mysqldump -u root -proot123 --all-databases > e:/fabric/backups/backup_completo_mysql.sql
mysqldump: [Warning] Using a password on the command line interface can be insecure.

Para restaurar o backup completo do banco de dados do fabric.
PS E:\> $env:MYSQL_PWD="root123" ; cat e:/fabric/backups/backup_completo_mysql.sql | docker exec -i 3080828256ed0215942b17fb379c03327f072503b661043601700180416273d1 /usr/bin/mysql -u root