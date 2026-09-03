# Screenshots — checkpoint visual da migração de frontend

Gerados por `frontend/scripts/screenshot.mjs` (Playwright), um arquivo por rota, nome igual ao da rota no `router/index.ts`. Servem de checkpoint visual a cada lote de telas migrado para o padrão de `05_PADRAO_FRONTEND.md` — comparar o "antes" (este commit) com o "depois" de cada lote.

**Como gerar:** com backend (porta 3001) e frontend (`npm run dev`, porta 5173) já rodando:

```bash
cd frontend
node scripts/screenshot.mjs                 # todas as rotas conhecidas
node scripts/screenshot.mjs stock warehouses # só as informadas
```

Login usa `admin@fabric.com`/`admin123` (usuário seedado) por padrão — configurável via `SCREENSHOT_EMAIL`/`SCREENSHOT_PASSWORD`/`SCREENSHOT_BASE_URL`.

**Estado atual:** captura de 02/09/2026, antes de qualquer view ser migrada para os componentes novos (`AppLayout`/`FormField`/`AppModal`/`DataTable`/`StatusBadge`) — é o "antes" de referência. Rotas com parâmetro dinâmico (`:id`) não estão incluídas na lista padrão do script.
