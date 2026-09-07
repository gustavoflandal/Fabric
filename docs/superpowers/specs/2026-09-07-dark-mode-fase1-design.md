# Dark Mode — Fase 1 (infraestrutura + telas-chave)

**Data:** 2026-09-07
**Status:** design aprovado, aguardando plano de implementação
**Etapa:** infraestrutura completa (toggle, persistência, resolução de preferência do sistema) + retrofit de 3 arquivos-chave (`AppLayout.vue`, `DashboardView.vue`, `WmsKpiDashboardView.vue`). O restante das ~50 telas do app fica claro por enquanto — fila de trabalho futuro, mesmo padrão da migração de 8 lotes do frontend.

## Contexto e motivação

O projeto não tem nenhuma infraestrutura de dark mode: `tailwind.config.js` não define `darkMode`, e cores como `bg-white`, `text-gray-900`, `bg-gray-50`, `border-gray-200` estão hardcoded diretamente em pelo menos 52 arquivos `.vue`. Implementar dark mode no app inteiro de uma vez é um esforço grande demais para uma primeira entrega; esta fase entrega a base funcional (toggle visível e funcionando em qualquer tela, porque mora no shell compartilhado) e retrofita as duas telas mais usadas como referência de padrão para lotes futuros.

## Abordagens consideradas

**Estratégia de tema:**

- **A — Tailwind `darkMode: 'class'` + variantes `dark:` por utilitário (escolhida).** Classe `dark` alternada em `<html>`; cada componente ganha `dark:bg-gray-800` ao lado de `bg-white`, etc. Padrão do ecossistema Tailwind, permite retrofit incremental por lote sem exigir uma reforma de todo o sistema de cores de uma vez.
- **B — `darkMode: 'media'` (só `prefers-color-scheme`, sem override manual).** Rejeitada: usuário precisa poder fixar um tema manualmente, independente do SO.
- **C — Tokens semânticos via CSS custom properties** (`bg-surface`, `text-primary` mapeados por variável CSS, trocados via classe). Mais elegante a longo prazo (fonte única da verdade de cor), mas exige converter o sistema de cores do app inteiro para começar a valer a pena — não combina com a decisão de fazer telas-chave primeiro e o resto depois. Pode ser revisitada se o retrofit completo (fase futura) mostrar que a receita de pares `dark:` vira ruído demais em arquivos com muitas cores.

**Interação do toggle:**

- **A — Botão cíclico de 3 estados: Claro → Escuro → Sistema → Claro (escolhida).** Um único botão, ícone muda conforme o modo (sol/lua/monitor), sem menu.
- **B — Menu dropdown com as 3 opções nomeadas.** Mais explícito, mas um controle a mais na UI para uma ação usada raramente. Descartada por simplicidade.

## Desenho

### 1. `theme.store.ts` (nova Pinia store, `frontend/src/stores/theme.store.ts`)

Estado:
- `mode: Ref<'system' | 'light' | 'dark'>` — inicializado de `localStorage.getItem('themeMode')`, default `'system'` se ausente/valor inválido.

Getters:
- `isDark: ComputedRef<boolean>` — se `mode === 'dark'`, `true`; se `'light'`, `false`; se `'system'`, resolve via `window.matchMedia('(prefers-color-scheme: dark)').matches`.

Ações:
- `setMode(mode)`: atualiza `mode.value`, persiste em `localStorage['themeMode']`.
- `initialize()`: chamada uma vez em `App.vue` (mesmo padrão de `authStore.initialize()`, que já é chamada lá). Registra um listener em `matchMedia('(prefers-color-scheme: dark)').addEventListener('change', ...)` que força reavaliação de `isDark` quando `mode === 'system'` e o SO muda de tema em tempo real (sem precisar recarregar a página). Um `watch(isDark, aplicarClasse, { immediate: true })` interno adiciona/remove a classe `dark` em `document.documentElement.classList`.

Não usa API do backend nem precisa de RBAC — é preferência 100% client-side, mesmo padrão de armazenamento local já usado para `userPermissions` em `auth.store.ts`.

### 2. `ThemeToggle.vue` (novo componente, `frontend/src/components/common/ThemeToggle.vue`)

Botão único, cicla os 3 modos a cada clique (`system → light → dark → system → ...`). Ícone SVG inline (sol para `light`, lua para `dark`, monitor para `system`), `aria-label` descrevendo o modo atual e o próximo (ex.: "Tema: Sistema. Clique para mudar para Claro."), consistente com os outros componentes de `components/common/`.

Montado em `AppLayout.vue`, na mesma linha de botões do header, à esquerda do botão "Sair" existente.

### 3. Retrofit desta fase (3 arquivos)

1. **`AppLayout.vue`** — shell inteiro (`bg-gray-50` do container raiz, `bg-white`/`border-gray-200` do header, `text-gray-900`/`text-gray-600` dos títulos). Como é o layout compartilhado por ~26 views, o toggle e o dark mode do header/fundo já ficam visíveis em qualquer tela do app assim que esta fase mergear, mesmo em views ainda não retrofitadas (o conteúdo delas continua claro, mas a moldura já responde).
2. **`DashboardView.vue`** — tela de entrada mais usada.
3. **`WmsKpiDashboardView.vue`** — serve de padrão de referência para lotes futuros em telas com tabs/cards/tabelas/gráficos Chart.js (inclusive: os gráficos Chart.js têm cor de texto/grade fixa hoje; nesta tela, ler `themeStore.isDark` e passar `color: '#e5e7eb'` (texto) / `'#374151'` (linhas de grade) nas opções do Chart.js quando `isDark` for `true`, mantendo os defaults atuais do Chart.js quando `false` — um gráfico com texto escuro sobre fundo escuro fica ilegível. Os 3 gráficos (`createCharts()`) precisam ser recriados ao alternar o tema, do mesmo jeito que já são recriados ao trocar o período — reaproveitar esse mecanismo existente com um `watch(themeStore.isDark, ...)` adicional).

**Receita de conversão** (para lotes futuros seguirem o mesmo padrão — atualizada após a implementação real, que divergiu levemente desta tabela na primeira versão do spec: `text-gray-600`/`text-gray-700` acabaram recebendo pares distintos, não o mesmo `dark:text-gray-400` para os dois):

| Classe clara | Par dark: |
|---|---|
| `bg-white` | `dark:bg-gray-800` |
| `bg-gray-50` | `dark:bg-gray-900` |
| `text-gray-900` | `dark:text-gray-100` |
| `text-gray-700` | `dark:text-gray-300` |
| `text-gray-600` / `text-gray-500` | `dark:text-gray-400` |
| `border-gray-200` | `dark:border-gray-700` |
| `divide-gray-200` | `dark:divide-gray-700` |
| `bg-red-50` / `border-red-200` | `dark:bg-red-950` / `dark:border-red-900` |
| `text-red-600` | `dark:text-red-400` |
| `hover:bg-gray-50` (linha de tabela) | `dark:hover:bg-gray-700` |

### 4. Fora de escopo desta fase

- Retrofit das demais ~50 views/componentes — fica como próximo item de fila, em lotes, mesmo padrão da migração de 8 lotes já documentada em `fabric-frontend-migration-status`.
- Nenhuma preferência de tema por usuário fica salva no backend — é só `localStorage`, por navegador. Se no futuro o app precisar sincronizar a preferência entre dispositivos, isso vira uma extensão da tabela de configurações por usuário (fora de escopo aqui).

## Testes

- `theme.store.spec.ts`: `setMode()` persiste e atualiza `isDark`; `mode==='system'` resolve corretamente a partir de um `matchMedia` mockado; o listener de mudança do SO atualiza `isDark` em tempo real quando `mode==='system'`, mas é ignorado quando o modo é manual (`light`/`dark`); `initialize()` aplica/remove a classe `dark` em `document.documentElement` de acordo.
- `ThemeToggle.spec.ts`: clique cicla os 3 modos na ordem certa e chama `setMode()` com o valor esperado; ícone/aria-label refletem o modo atual.
- Verificação manual (screenshot) do Dashboard e do KPI dashboard do WMS em ambos os modos antes de mergear — sem teste visual/e2e automatizado nesta fase.
