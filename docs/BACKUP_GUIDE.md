# 🗄️ Guia Rápido de Backup e Restauração

## 📦 Fazer Backup

```bash
cd backend
npm run backup
```

**Resultado:** Arquivo salvo em `backups/fabric_backup_[timestamp].json`

---

## 🔄 Restaurar Backup

### 1. Listar Backups Disponíveis

```bash
cd backend
npm run restore
```

### 2. Restaurar um Backup Específico

```bash
cd backend
npm run restore ../backups/fabric_backup_2025-10-20T18-07-02-463Z.json
```

### ⚠️ IMPORTANTE

- A restauração **DELETA TODOS** os dados atuais
- Faça backup antes de restaurar
- Aguarde 3 segundos após iniciar (Ctrl+C para cancelar)
- Pare o servidor antes de restaurar (recomendado)

---

## 📊 Estrutura dos Arquivos

### Backup (JSON)
```
backups/
├── fabric_backup_2025-10-20T18-07-02-463Z.json  ← Backup completo
├── fabric_backup_2025-10-19T10-30-15-123Z.json  ← Backup anterior
└── README.md                                     ← Documentação
```

### Scripts
```
backend/
├── backup-database.js   ← Script de backup
└── restore-database.js  ← Script de restauração
```

---

## 🎯 Casos de Uso

### Backup Diário (Recomendado)
```bash
# Adicionar ao cron ou Task Scheduler
cd /path/to/fabric/backend && npm run backup
```

### Antes de Atualização
```bash
# 1. Fazer backup
cd backend
npm run backup

# 2. Atualizar sistema
git pull
npm install

# 3. Se der problema, restaurar
npm run restore ../backups/[ultimo-backup].json
```

### Migração de Ambiente
```bash
# Ambiente A (Produção)
cd backend
npm run backup

# Copiar arquivo para Ambiente B
# scp backups/fabric_backup_*.json user@server-b:/path/

# Ambiente B (Homologação)
cd backend
npm run restore ../backups/fabric_backup_*.json
```

### Teste de Funcionalidades
```bash
# 1. Backup do estado atual
npm run backup

# 2. Testar funcionalidade

# 3. Restaurar se necessário
npm run restore ../backups/[backup-antes-teste].json
```

---

## 📋 Checklist de Backup

### Diário
- [ ] Fazer backup automático
- [ ] Verificar tamanho do arquivo
- [ ] Manter últimos 7 dias

### Semanal
- [ ] Verificar integridade dos backups
- [ ] Testar restauração em ambiente de teste
- [ ] Arquivar backups antigos

### Mensal
- [ ] Backup completo para armazenamento externo
- [ ] Documentar mudanças importantes
- [ ] Revisar política de retenção

---

## 🔐 Segurança

### ✅ Boas Práticas
- Backups NÃO são commitados no Git
- Armazenar em local seguro
- Criptografar para produção
- Testar restauração regularmente

### ❌ Evitar
- Commitar backups no repositório
- Compartilhar backups publicamente
- Manter apenas 1 backup
- Nunca testar restauração

---

## 🆘 Solução de Problemas

### Erro: "Arquivo não encontrado"
```bash
# Verificar caminho correto
ls ../backups/

# Usar caminho absoluto
npm run restore /caminho/completo/para/backup.json
```

### Erro: "Cannot find module @prisma/client"
```bash
# Instalar dependências
npm install
npx prisma generate
```

### Erro: "Foreign key constraint"
```bash
# O script já trata isso, mas se persistir:
# 1. Verificar integridade do backup
# 2. Usar backup mais recente
# 3. Executar seed: npm run prisma:seed
```

### Restauração Lenta
```bash
# Normal para backups grandes
# Aguarde conclusão (pode levar minutos)
# Não interrompa o processo
```

---

## 📞 Suporte

Para mais informações, consulte:
- `backups/README.md` - Documentação completa
- `backend/backup-database.js` - Código do backup
- `backend/restore-database.js` - Código da restauração

---

## 📅 Histórico de Versões

- **v1.0.0** (2025-10-20): Primeira versão com backup/restore completo
