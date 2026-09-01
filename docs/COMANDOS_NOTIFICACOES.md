# 🚀 Comandos para Ativar Sistema de Notificações

Execute estes comandos na ordem para ativar o sistema de notificações:

---

## 1️⃣ Criar Notificações de Teste

```bash
cd backend
npm run prisma:seed-notifications
```

**Resultado esperado:**
```
🔔 Iniciando seed de notificações...
✅ 5 usuários encontrados
📝 Criando 40 notificações...
🔴 Material Indisponível (PRODUCTION) - Prioridade 4
🔴 Taxa de Refugo Crítica (QUALITY) - Prioridade 4
⚠️  Ordem de Produção Atrasada (PRODUCTION) - Prioridade 3
...
✅ 40 notificações criadas com sucesso!
```

---

## 2️⃣ Iniciar o Backend

```bash
cd backend
npm run dev
```

**Resultado esperado:**
```
✅ Database connected successfully
✅ Event listeners initialized
✅ Notification scheduler initialized
[NotificationScheduler] ✅ 5 agendamentos iniciados:
  - A cada 5 min: Ordens atrasadas e gargalos
  - A cada 15 min: Níveis de estoque
  - Diariamente às 8h: Resumo do dia
  - A cada 1 hora: Limpeza de notificações antigas
  - A cada 2 horas: Capacidade dos centros
🚀 Server running on port 3001
```

---

## 3️⃣ Iniciar o Frontend

**Abra um NOVO terminal** e execute:

```bash
cd frontend
npm run dev
```

**Resultado esperado:**
```
VITE v5.x.x  ready in xxx ms
➜  Local:   http://localhost:5173/
```

---

## 4️⃣ Testar no Navegador

1. Acesse: `http://localhost:5173`
2. Faça login com qualquer usuário
3. Observe o **sino no header** com badge vermelho
4. Clique no sino para ver as notificações
5. Vá ao **Dashboard** e veja o **Centro de Notificações**

---

## ✅ Checklist de Verificação

- [ ] Backend rodando sem erros
- [ ] Frontend rodando sem erros
- [ ] Badge aparece no sino (número > 0)
- [ ] Dropdown abre ao clicar no sino
- [ ] Centro de Notificações aparece no Dashboard
- [ ] Contadores mostram valores corretos
- [ ] Ao clicar em notificação, ela marca como lida
- [ ] Badge diminui ao marcar como lida

---

## 🔍 Verificar Notificações no Banco (Opcional)

```bash
cd backend
npx prisma studio
```

Navegue até a tabela **notifications** e veja todas as notificações criadas.

---

## 🐛 Se Algo Der Errado

### Erro: "Cannot find module 'node-cron'"
```bash
cd backend
npm install node-cron
npm install -D @types/node-cron
```

### Badge não aparece
```bash
# Verifique se há notificações no banco
cd backend
npx prisma studio
# Abra a tabela "notifications"
```

### Erro 404 na API
```bash
# Verifique se o backend está rodando
# Teste a API diretamente:
curl http://localhost:3001/api/v1/notifications/count/unread
```

---

## 📚 Documentação Completa

- `docs/SISTEMA_NOTIFICACOES.md` - Documentação técnica
- `docs/NOTIFICACOES_TESTE.md` - Guia de testes
- `docs/RESUMO_NOTIFICACOES.md` - Resumo da implementação

---

**Pronto! O sistema de notificações está funcionando! 🎉**
