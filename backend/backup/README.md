# 📦 Backup do Banco de Dados - Fabric

## 📁 Diretório de Backups

Este diretório contém os backups do banco de dados do sistema Fabric.

---

## 🚀 Como Criar um Backup

### **Método 1: Via NPM Script (Recomendado)**

```bash
cd backend
npm run backup
```

### **Método 2: Via Script Direto**

```bash
cd backend
npx tsx scripts/backup-database.ts
```

---

## 📊 Conteúdo do Backup

Cada backup inclui:

### **Usuários e Segurança**
- ✅ Usuários
- ✅ Perfis (Roles)
- ✅ Permissões

### **Cadastros Básicos**
- ✅ Unidades de Medida
- ✅ Categorias de Produtos
- ✅ Fornecedores
- ✅ Clientes
- ✅ Centros de Trabalho

### **Produtos**
- ✅ Produtos
- ✅ BOMs (Estruturas de Produto)
- ✅ Roteiros de Produção

### **Produção**
- ✅ Ordens de Produção
- ✅ Operações
- ✅ Apontamentos

### **Compras**
- ✅ Orçamentos de Compra
- ✅ Pedidos de Compra
- ✅ Recebimentos

### **Estoque**
- ✅ Movimentações de Estoque

### **Auditoria**
- ✅ Logs de Auditoria (últimos 1000)

---

## 📝 Formato do Arquivo

**Nome:** `fabric_backup_YYYY-MM-DDTHH-MM-SS.json`

**Exemplo:** `fabric_backup_2025-10-20T20-22-16.json`

**Estrutura:**
```json
{
  "timestamp": "2025-10-20T20:22:16.123Z",
  "version": "1.0.0",
  "data": {
    "users": [...],
    "roles": [...],
    "permissions": [...],
    ...
  }
}
```

---

## 🔄 Como Restaurar um Backup

### **⚠️ ATENÇÃO: A restauração irá SOBRESCREVER todos os dados atuais!**

```bash
# 1. Fazer backup do estado atual (segurança)
npm run backup

# 2. Restaurar backup específico
npm run restore -- backup/fabric_backup_2025-10-20T20-22-16.json
```

---

## 📅 Recomendações

### **Frequência de Backup**

- **Desenvolvimento:** Antes de mudanças importantes
- **Produção:** Diariamente (automatizado)
- **Antes de Migrations:** Sempre!

### **Armazenamento**

- ✅ Manter backups locais por 7 dias
- ✅ Armazenar backups importantes em nuvem
- ✅ Testar restauração periodicamente

### **Automação (Produção)**

```bash
# Adicionar ao cron (Linux) ou Task Scheduler (Windows)
# Executar diariamente às 2h da manhã
0 2 * * * cd /path/to/fabric/backend && npm run backup
```

---

## 📊 Último Backup

**Data:** 20/10/2025 às 20:22:16  
**Arquivo:** `fabric_backup_2025-10-20T20-22-16.json`  
**Tamanho:** 0.10 MB

**Estatísticas:**
- Usuários: 4
- Produtos: 14
- BOMs: 4
- Ordens de Produção: 5
- Pedidos de Compra: 0
- Movimentações de Estoque: 0
- Logs de Auditoria: 21

---

## 🔒 Segurança

- ❌ **NÃO** commitar backups no Git (já está no .gitignore)
- ✅ Manter backups em local seguro
- ✅ Criptografar backups sensíveis
- ✅ Controlar acesso aos arquivos de backup

---

## 📞 Suporte

Em caso de problemas com backup/restore, consulte:
- Documentação: `docs/`
- Logs: `logs/`
- Equipe de desenvolvimento

---

*Última atualização: 20/10/2025*
