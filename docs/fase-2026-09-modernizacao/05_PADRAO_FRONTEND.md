# Padrão de Interface do Frontend — Fabric

**Data:** 02/09/2026
**Fase:** 5 do cronograma (`02_CRONOGRAMA_IMPLEMENTACOES.md`), complemento de `03_DECISAO_STACK_FRONTEND.md`
**Status:** documento de referência — formaliza o padrão que já existe no código e define o contrato para telas novas
**Escopo:** auditoria das 28 views em `frontend/src/views/` e dos 16 componentes em `frontend/src/components/`, mais router, composables, configuração do Tailwind e clientes HTTP.

**O que este documento NÃO é:** não é um redesign. A avaliação do usuário — "o design me agrada, porém creio não haver um padrão rígido para a interface" — está correta e é a premissa aqui. O visual atual é bom e coerente na maior parte das telas; o problema é que o mesmo problema de UI foi resolvido de 2 a 4 formas diferentes em domínios diferentes, sem nada escrito que diga qual é a certa. Este documento escolhe, entre as variantes que já existem, qual passa a ser a oficial.

**Método:** toda afirmação abaixo foi verificada contra o código em `frontend/src/` no estado atual da branch `padroes-frontend-analise` (a partir de `main`, commit `404a8c6`). Cada exemplo cita arquivo e linha. Quando uma categoria já é consistente, o documento diz isso explicitamente em vez de fabricar um achado.

---

## 1. Estado atual, resumido

### 1.1 Stack confirmada no código

| Item | Verificado em | Situação |
|---|---|---|
| Vue 3.4 + Composition API | `frontend/package.json:20` | ✅ **100% `<script setup>`** — as 44 SFCs (28 views + 16 componentes) usam `<script setup>`. Nenhuma Options API, nenhum `defineComponent`. |
| TypeScript | `frontend/package.json:38` | ⚠️ 42 de 44 SFCs usam `<script setup lang="ts">`. Duas usam `<script setup>` sem `lang`: `views/warehouses/WarehousesView.vue:183` e `views/warehouse-structures/WarehouseStructuresView.vue`. |
| Pinia | 20 stores em `src/stores/` | ✅ usado |
| Vue Router 4 | `src/router/index.ts` | ✅ usado |
| Tailwind CSS 3.4 | `frontend/tailwind.config.js` | ✅ usado, com paleta customizada (§2.7) |
| Chart.js / vue-chartjs | `package.json:23,25` | ⚠️ usado em **uma** view apenas: `views/pcp/PCPDashboardView.vue` |
| jsPDF + jspdf-autotable | `package.json:24` | ✅ usado em `src/utils/pdf-generator.ts`, consumido por `views/counting/CountingPlanForm.vue` |
| **@heroicons/vue** | `package.json:15` | ❌ **dependência morta.** `grep -rn "heroicons" frontend/src/` não retorna nenhuma ocorrência. Zero imports em todo o código. Ver §2.8. |
| Biblioteca de componentes de UI | — | ✅ correto: nenhuma. Todo componente é escrito à mão. |

**Correção a `03_DECISAO_STACK_FRONTEND.md`:** aquele documento afirma (linha 24) "Composition API e Options API misturados, conforme a view" e (linha 25) "44 views Vue". Nenhuma das duas afirmações se sustenta hoje: são **28 views** (mais 16 componentes = 44 SFCs, provável origem da confusão do número) e **100% Composition API com `<script setup>`**. Esse ponto está mais saudável do que o registro anterior sugeria.

### 1.2 Impressão geral honesta

**O que está bom e deve ser preservado:**

- Existe um **arquétipo de tela CRUD** claramente reconhecível e repetido com fidelidade alta em ~10 views (cadastros de suporte: fornecedores, clientes, unidades, centros de trabalho, armazéns, estruturas, produtos). Quem abre `SuppliersView.vue` e `CustomersView.vue` lado a lado vê o mesmo esqueleto quase linha a linha. Isso não é acidente, é padrão de fato — só nunca foi escrito.
- A paleta de marca **está tokenizada** em `tailwind.config.js` (`primary`, `secondary`, `accent`, `fabric.*`) e é dominante: 528 ocorrências de `primary-*` contra 119 de `blue-*`.
- A Fase 5 entregou `useToast`/`useConfirm`/`useDebounce` e a **erradicação foi completa**: `grep -rn "alert(" views/ components/` e `grep -rn "confirm(" views/ components/` retornam **zero** ocorrências. Isso é um sucesso e é o precedente que este documento adota como modelo — uma decisão tomada, aplicada em todo lugar, verificável por grep.
- `Button.vue` e `Card.vue` têm adoção quase universal (26 de 28 views importam ambos).

**O que não está bom:**

- **Não existe layout compartilhado.** `App.vue` monta apenas `<RouterView />` + os dois containers globais. As 26 views autenticadas cada uma **reescreve o mesmo bloco `<header>` de 22 linhas** (logo, saudação, botão Sair). Ver §2.1.
- **Nenhuma tabela do sistema tem ordenação.** `grep -rn "sortBy\|orderBy\|sortOrder"` em `views/` e `components/` retorna zero. É uma lacuna de produto uniforme, não uma inconsistência.
- **Paginação existe em 5 de 28 views.** As outras carregam com `limit: 100` fixo e simplesmente não mostram o resto.
- **Acessibilidade ficou isolada em uma tela.** A correção da Fase 5 em `WorkCentersView.vue` não se espalhou (§2.9).
- O módulo de contagem (6 views, o mais recente antes desta fase) diverge sistematicamente do resto: cor, loading, empty state, filtros, uso de `Card`. Não é pior — em empty state é **melhor** — mas é outro dialeto.

---

## 2. Inventário de padrões por categoria

### 2.1 Estrutura de página — ⚠️ **padrão de fato, duplicado 26 vezes**

Existe um esqueleto único e ele é seguido. O problema é que ele é **copiado**, não importado.

**O esqueleto (verificado idêntico em 26 views):**

```
<div class="min-h-screen bg-gray-50">
  <header class="bg-white shadow-sm border-b border-gray-200">   ← logo + saudação + Sair
  <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div class="mb-6 flex justify-between items-center">          ← título + subtítulo + ação primária
    <Card class="mb-6">                                           ← filtros
    <Card>                                                        ← tabela
  </main>
  <div v-if="showModal" class="fixed inset-0 ...">                ← modal
</div>
```

O bloco `<header>` é **byte a byte o mesmo** em, entre outras: `views/suppliers/SuppliersView.vue:3-24`, `views/customers/CustomersView.vue`, `views/warehouses/WarehousesView.vue:3-24`, `views/units/UnitsOfMeasureView.vue:4-25`, `views/stock/StockView.vue:3-24`, `views/products/ProductsView.vue:3-17`, `views/counting/CountingPlanList.vue:3-24`, `views/counting/CountingSessionExecute.vue:3-24`, `views/warehouse-structures/WarehouseStructuresView.vue:3-24`. Cada uma dessas views também redeclara sua própria cópia de:

```ts
const handleLogout = async () => { await authStore.logout(); router.push('/login'); };
```

**O título da página é consistente:** `<h2 class="text-3xl font-bold text-gray-900">` aparece em 23 views (`SuppliersView.vue:29`, `ProductsView.vue:22`, `RolesListView.vue:35`, `CountingPlanList.vue:32`, etc.), quase sempre seguido de `<p class="mt-1 text-sm text-gray-600">` com uma frase descritiva. É um dos pontos mais consistentes do sistema.

**Divergências reais:**

1. **`views/pcp/PCPDashboardView.vue` não tem header nenhum** (`:1-4` vai direto de `<div class="min-h-screen">` para `<main>`). O usuário nessa tela não tem logo, não tem link para o dashboard e **não tem botão de Sair**. Também é a única que usa `w-full` em vez de `max-w-7xl` no `<main>`.
2. **A navegação do header varia por view.** A maioria tem só `Início`; `views/users/UsersListView.vue:13-21` tem `Início` + `Perfis` + `Logs`; `views/DashboardView.vue:13` troca o link `Início` por `<NotificationBell />`.
3. **Existe um `components/AppHeader.vue` órfão.** Ele implementa exatamente esse header (`:1-46`), mas `grep -rn "AppHeader" views/ components/` retorna **zero importações**. Foi escrito e esquecido; além disso usa `hover:text-blue-600` (`:9`) em vez de `primary`, e não tem a logo.
4. **`views/HomeView.vue` é órfã** — nenhuma rota em `src/router/index.ts` aponta para ela; o conteúdo é uma tela de "Sistema em Desenvolvimento" listando a stack.

**Breadcrumb:** não existe em nenhuma tela do sistema. Telas de segundo nível (ex.: `views/counting/CountingSessionReport.vue`, `views/counting/CountingPlanForm.vue`) não indicam de onde vieram.

**Rotas:** `src/router/index.ts` é plano — 28 rotas irmãs, sem rotas aninhadas, sem `component` de layout, sem `meta` além de `requiresAuth`. O guard (`:192-210`) só verifica autenticação. **Não há guard de permissão nem de módulo** — coerente com o que `04_ARQUITETURA_MODULAR_LICENCIAMENTO.md:§2` já registrou sobre o backend.

### 2.2 Botões — ✅ **componente existe e é adotado; ⚠️ ações de linha divergem**

`components/common/Button.vue` é sólido: 6 variantes (`primary`/`secondary`/`outline`/`danger`/`success`/`light`), 3 tamanhos, `loading` com spinner embutido (`:8-13`), `fullWidth`, e estados de foco/disabled corretos no `base` (`:44`). **26 das 28 views o importam.**

**Onde ele é usado com consistência:** ação primária no header da página, botões de rodapé de modal (`Cancelar` outline + `Salvar` primary, sempre com `class="flex-1"`), e o `Sair` (`variant="outline" size="sm"`).

**Onde o padrão quebra — ações por linha de tabela.** Aqui existem **quatro** soluções diferentes para a mesma necessidade:

| Estilo | Exemplo | Onde |
|---|---|---|
| A. Link de texto colorido | `<button class="text-primary-600 hover:text-primary-900">Editar</button>` | `SuppliersView.vue:103-107`, `WorkCentersView.vue:86-88`, `ProductsView.vue:91-95`, `UsersListView.vue:127-138`, `AuditLogsView.vue:216-221` — **é o dominante** |
| B. Mesmo estilo, mas em `blue-*` | `class="text-blue-600 hover:text-blue-900 font-medium"` | `CountingPlanList.vue:145-150` e `:172-177`, `WarehouseStructuresView.vue:106-112` |
| C. Componente `<Button size="sm">` | `<Button variant="outline" size="sm">Ver</Button>` | `PurchaseOrdersView.vue:103-111` |
| D. Pílulas de fundo claro | `class="flex-1 px-3 py-2 text-sm bg-primary-50 text-primary-700 rounded-lg"` | `RolesListView.vue:96-113` (cards, não tabela) |

E a **cor da ação secundária** também varia dentro do estilo A: `text-yellow-600` para Ativar/Desativar (`SuppliersView.vue:104`), `text-indigo-600` para BOMs e `text-purple-600` para Roteiros (`ProductsView.vue:92-93`), `text-green-600` para Ativar (`CountingPlanList.vue:153`).

**Rótulo do botão "novo":** duas formas — `<span class="mr-2">+</span>Novo X` (`SuppliersView.vue:32-35`, `WorkCentersView.vue:25`, `CustomersView.vue:26`) e `+ Novo X` literal (`UsersListView.vue:44`, `RolesListView.vue:41`, `ProductionOrdersView.vue:36`, `PurchaseOrdersView.vue:35`).

### 2.3 Formulários — ⚠️ **classe Tailwind repetida ~130 vezes; validação quase inexistente**

**O par label+input padrão** (repetido literalmente em praticamente todo formulário do sistema):

```html
<label class="block text-sm font-medium text-gray-700 mb-1">Código *</label>
<input v-model="formData.code" type="text" required
       class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
```

Verificado em `SuppliersView.vue:127-133`, `WarehousesView.vue:101-107`, `ProductsView.vue:116-117`, `WorkCentersView.vue:106-107`, `WarehouseStructuresView.vue:156-164`, `UserFormModal.vue:33-42`, entre muitos outros. **É consistente** — é o mesmo string de classes. Mas é uma string de 88 caracteres copiada em mais de cem lugares, e o `components/common/Input.vue` que existe para isso é importado por **apenas duas views**: `views/auth/LoginView.vue:104` e `views/users/UsersListView.vue:192`.

Variantes menores do mesmo campo, todas presentes:
- `class="w-full border-gray-300 rounded-md shadow-sm"` (sem `focus:`) — `CountingPlanList.vue:53`, `CountingSessionList.vue:42`, `WarehousesView.vue:42`
- `class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"` — `StockView.vue:94`, `ReportsView.vue:39`

**Marcador de campo obrigatório:** duas convenções. Asterisco literal no texto do label (`SuppliersView.vue:127` — `Código *`) na maioria; e `<span class="text-red-500">*</span>` em `CountingPlanForm.vue:48` e em `components/common/Input.vue:5`.

**Validação:** o sistema **não tem** validação client-side estruturada. Não há biblioteca (nem VeeValidate, nem Zod no frontend), e a validação é o atributo HTML `required`/`minlength` do input. A **única** exceção é `views/auth/LoginView.vue:121-146`, que tem um `validateForm()` manual escrevendo em um objeto `errors` reativo, consumido pelo `:error` do `Input.vue`. Esse é o único lugar onde o suporte a erro por campo que o `Input.vue:27-29` oferece é realmente usado. Na prática, erros de validação chegam do backend e viram toast (§2.6).

Um caso de sanitização inline vale registro por ser único: `WarehouseStructuresView.vue:170-199` faz `@input="e => formData.floors = e.target.value.replace(/[^0-9]/g, '')"` em 7 campos numéricos — solução funcional, mas escrita seis vezes no template e em nenhum outro lugar do sistema.

### 2.4 Tabelas — ✅ **markup consistente; ⚠️ paginação, loading e empty divergem; ❌ sem ordenação**

**O markup da tabela é o ponto mais consistente do frontend.** Este bloco é idêntico em ~15 views:

```html
<table class="min-w-full divide-y divide-gray-200">
  <thead class="bg-gray-50">
    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
  <tbody class="bg-white divide-y divide-gray-200">
    <tr class="hover:bg-gray-50">
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
```

(`SuppliersView.vue:75-96`, `UnitsOfMeasureView.vue:105-140`, `UsersListView.vue:72-125`, `AuditLogsView.vue:166-213`, `WarehousesView.vue:48-83`, `WarehouseStructuresView.vue:75-99`.) Variações menores: `px-4 py-3` em vez de `px-6 py-4` onde há muitas colunas (`ProductsView.vue:66-73`, `ProductionOrdersView.vue:78-85`, `CountingPlanList.vue:104-121`), e o `tracking-wider` do `<th>` às vezes é omitido (`SuppliersView.vue:78` vs `UnitsOfMeasureView.vue:108`).

**Badge de status:** também consistente — `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium` + par `bg-X-100 text-X-800`. Verificado em `SuppliersView.vue:98`, `WorkCentersView.vue:81`, `UsersListView.vue:113-118`, `WarehouseStructuresView.vue:101`, `CountingPlanList.vue:303-307`. **Mas** a função que mapeia status→classe (`getStatusClass`) é reimplementada em 9 arquivos: `AuditLogsView.vue:551`, `CountingDashboard.vue:457`, `CountingPlanList.vue:301`, `CountingSessionList.vue:227`, `CountingSessionReport.vue:242`, `ProductionOrdersView.vue:310`, `PurchaseOrdersView.vue:345`, `PurchaseQuotationsView.vue:329`, `ProductionOrderDetailsModal.vue:312`. Cada uma com seu próprio dicionário e sua própria formatação de rótulo (`formatStatus`, `getStatusLabel`).

**Paginação — três implementações + a maioria sem nenhuma:**

| Variante | Views | Detalhe |
|---|---|---|
| A. `Anterior`/`Próxima` com `<Button variant="outline" size="sm">` + contador "Mostrando X a Y de Z" | `UsersListView.vue:146-172`, `AuditLogsView.vue:229-255`, `UnitsOfMeasureView.vue:176-202` | Bloco **byte a byte idêntico** nas três |
| B. Números de página com `<button>` cru | `NotificationsView.vue:250-276` | Usa `bg-blue-600` para a página ativa |
| C. Nenhuma UI, `limit: 100` fixo | `SuppliersView.vue:227`, `WorkCentersView.vue:161`, `ProductsView.vue:32`, e o restante | O estado `pagination` é lido da API e descartado |

**Estado de carregamento — três variantes:**

| Variante | Onde |
|---|---|
| A. Texto puro: `<p class="text-gray-500">Carregando...</p>` | 11 views — `SuppliersView.vue:67`, `UnitsOfMeasureView.vue:97`, `UsersListView.vue:64`, `AuditLogsView.vue:158`, `ProductsView.vue:60`, `WorkCentersView.vue:56`, `CustomersView.vue:47`, `RolesListView.vue:47`, `ProductionOrdersView.vue:66`, `ProductionPointingsView.vue:55`, `WarehouseStructuresView.vue:67` |
| B. Spinner só, em **azul**: `animate-spin ... border-b-2 border-blue-600` | 5 views do módulo de contagem — `CountingDashboard.vue:49`, `CountingPlanList.vue:96`, `CountingSessionExecute.vue:45`, `CountingSessionList.vue:71`, `CountingSessionReport.vue:59` |
| C. Spinner + texto, em `primary`: `border-b-2 border-primary-600` + `<p>Carregando...</p>` | `PurchaseOrdersView.vue:59-60`, `PurchaseQuotationsView.vue:60-61`, `PCPDashboardView.vue:7-8` |

(Mais uma quarta, isolada: `StockView.vue:127` usa o emoji `⏳` como spinner.)

**Estado vazio — duas variantes:**

- A. Texto puro: `<p class="text-gray-500">Nenhum X encontrado</p>` — dominante (`SuppliersView.vue:71`, `UnitsOfMeasureView.vue:101`, `UsersListView.vue:68`, `WorkCentersView.vue:57`, `AuditLogsView.vue:162`, `PurchaseOrdersView.vue:64`).
- B. Ilustração SVG + título + frase de ajuda: `CountingPlanList.vue:185-191` (`Nenhum plano encontrado` / `Comece criando um novo plano de contagem.`). **Esta é a melhor do sistema.**
- C. Texto + CTA: `ProductionOrdersView.vue:69-72` acrescenta `<Button @click="openCreateModal">Criar Primeira Ordem</Button>`. **Também excelente**, e a única com ação.

**Ordenação:** ❌ inexistente em todo o sistema (grep por `sortBy|orderBy|sortOrder` em `views/` e `components/` = zero). Não é inconsistência; é funcionalidade ausente por igual.

### 2.5 Modais — ⚠️ **quatro overlays diferentes e dois contratos de props**

**Overlay — quatro implementações:**

| # | Classes | Ocorrências |
|---|---|---|
| 1 | `fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50` (às vezes com ` p-4`) | **Dominante, ~16x** — `WorkCentersView.vue:97`, `SuppliersView.vue:116`, `WarehousesView.vue:90`, `ProductsView.vue:107`, `CustomersView.vue:89`, `UnitsOfMeasureView.vue:209`, `AuditLogsView.vue:262`, `WarehouseStructuresView.vue:145,258,356`, `StockView.vue:199,262,325,378`, `ProductionOrdersView.vue:121`, `ProductionPointingsView.vue:112`, `UserFormModal.vue:4`, `RoleFormModal.vue:4`, `PermissionsModal.vue:4`, `ProductionOrderDetailsModal.vue:2`, `RoutingManagerModal.vue:2` |
| 2 | `fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50` + caixa `relative top-20 mx-auto` | 4x, só em compras — `PurchaseOrdersView.vue:121,202`, `PurchaseQuotationsView.vue:122,187` |
| 3 | `fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8` (sintaxe de opacidade moderna) | 3x — `BomManagerModal.vue:4,94,207` |
| 4 | Backdrop separado em duas camadas: `fixed inset-0 z-50 overflow-y-auto` + `<div class="fixed inset-0 bg-black opacity-30">` | 2x — `ProductSelectorModal.vue:2-4`, `TeamAssignerModal.vue:2-4` |
| — | `fixed inset-0 z-[60] ... bg-black bg-opacity-50 px-4` | `ConfirmDialogContainer.vue:5` — z-index maior de propósito, correto |

**Caixa do modal:** a forma dominante é `bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto` + `@click.stop` (`WorkCentersView.vue:98`, `SuppliersView.vue:117`, `WarehousesView.vue:91`, `ProductsView.vue:108`, `UserFormModal.vue:7`). Tamanhos maiores usam `max-w-4xl` (`WarehouseStructuresView.vue:259`, `PurchaseOrdersView.vue:122`).

**Botão de fechar — três formas:** `✕` como texto (`WorkCentersView.vue:102`, `SuppliersView.vue:121`, `ProductsView.vue:112`, `UserFormModal.vue:25`); `&times;` HTML (`PurchaseOrdersView.vue:126`); SVG inline (`WarehouseStructuresView.vue:265-267`).

**Contrato de componente de modal — duas famílias incompatíveis:**

| Família | Props | Emits | Componentes |
|---|---|---|---|
| A. `isOpen` | `isOpen: boolean` + entidade | `close`, `success` (ou `select`/`saved`) | `UserFormModal.vue:162-170`, `RoleFormModal.vue:133-141`, `PermissionsModal.vue:180-188`, `ProductSelectorModal.vue:79-87`, `TeamAssignerModal.vue:112-120` |
| B. `v-model` | `modelValue: boolean` + entidade | `update:modelValue` (+ `refresh`) | `BomManagerModal.vue:291-298`, `RoutingManagerModal.vue:296-303`, `ProductionOrderDetailsModal.vue:234-242` |

A consequência aparece no consumo: `ProductsView.vue:103-104` usa `<BomManagerModal v-model="showBomModal" />` enquanto `UsersListView.vue:177-182` usa `<UserFormModal :is-open="showUserModal" @close="..." @success="..." />`.

**Fechamento:** o padrão majoritário é `@click="closeModal"` no overlay + `@click.stop` na caixa. **Tecla Esc:** implementada em **exatamente uma view** — `WorkCentersView.vue:181-187` — e no `ConfirmDialogContainer.vue:6`. Em todas as outras, Esc não fecha o modal.

### 2.6 Feedback — ✅ **toast/confirm 100% padronizados; ⚠️ erro de requisição e loading não**

**Este é o melhor resultado da auditoria.** A Fase 5 concluiu o trabalho:

- `grep -rn "alert(" views/ components/` → **0 resultados**
- `grep -rn "confirm(" views/ components/` → **0 resultados**

`useToast` é importado por 20 das 28 views e 5 componentes; `confirmDialog` por 16 views e 4 componentes. `App.vue:13-14` monta `ToastContainer` e `ConfirmDialogContainer` uma única vez. Os dois composables são bem escritos: `useConfirm.ts:44-47` resolve promessa órfã antes de abrir uma nova; `useToast.ts:27-32` tem duração por severidade (erro 6s, sucesso 4s); `useDebounce.ts:35-39` cancela o timer no `onUnmounted`.

`useDebounce` é adotado em 11 views, sempre no mesmo idioma: `const debouncedFilterChange = useDebounce(handleFilterChange, 350)` no `@input` da busca (`SuppliersView.vue:253`, `WorkCentersView.vue:176`, `ProductsView.vue`, `CustomersView.vue:33`, `UsersListView.vue:237`, `WarehouseStructuresView.vue:47`). **Consistente.**

**Onde o feedback ainda diverge:**

1. **Mensagem de erro de requisição.** O idioma dominante é `toast.error(error.response?.data?.message || 'Erro ao salvar X')` — 44 ocorrências de `response?.data?.message` em views/componentes (`WorkCentersView.vue:202,212,224`, `SuppliersView.vue:284,294,306`, `WarehousesView.vue:277,287,299`). **Mas** o módulo de contagem engole erros no console sem toast: `CountingPlanList.vue:242-244` e `:250-253` fazem só `console.error('Erro ao ativar plano:', error)` — o usuário clica em "Ativar", nada acontece e nada é dito. Mesmo padrão em `CountingDashboard.vue:412,422`, `CountingSessionList.vue:207`, `CountingSessionReport.vue:206`. Há 51 `console.error` em `views/`.
2. **Estado de erro na tela.** Apenas **uma** view distingue "carregando", "vazio" e "falhou": `views/pcp/PCPDashboardView.vue:12-15`, com faixa `bg-red-50 border border-red-200` e botão `Tentar Novamente`. Todas as outras colapsam falha em "lista vazia" ou em um toast que já sumiu. (`RoutingManagerModal.vue:21` tem algo equivalente, vindo do `error` da store.)
3. **`console.log` em produção.** `DashboardView.vue:110-135` deixa 5 blocos de log de permissões sem guarda `import.meta.env.DEV`; `LoginView.vue:151,158-159,162` loga o fluxo de login. (`App.vue:21-33` e `api.service.ts:32` fazem certo, com guarda de DEV.)
4. **Feedback silencioso em sucesso.** `WorkCentersView.vue:206-215` (toggle de ativação) e `SuppliersView.vue:288-297` recarregam a lista sem toast de sucesso, enquanto `handleSubmit` e `handleDelete` das mesmas views emitem toast.

### 2.7 Cores e tipografia — ⚠️ **paleta tokenizada e dominante, com dois desvios reais**

**A paleta existe e é boa.** `frontend/tailwind.config.js:8-107` define `fabric.slate/cyan/orange/gray` (cores da logo) e os aliases `primary` (#4a6b7c), `secondary` (#48C9B0) e `accent` (#F39C12), cada um com escala 50–900. `frontend/src/style.css` tem só 8 linhas: as três diretivas do Tailwind e `body { @apply bg-gray-50 text-gray-900 }`. **Não há CSS escrito à mão em lugar nenhum** exceto a transição do `ToastContainer.vue:54-63` — o que é uma qualidade, não um defeito.

**Tipografia é consistente por convenção**, sem tokens formais: `text-3xl font-bold text-gray-900` para título de página (23 views), `text-2xl font-bold text-gray-900` para título de modal, `text-lg font-semibold` para seções, `text-sm font-medium text-gray-700` para labels, `text-xs font-medium text-gray-500 uppercase` para cabeçalho de tabela. Nenhuma view define fonte própria.

**Desvio 1 — `blue-*` como primário paralelo.** 119 ocorrências de `blue-[0-9]00`, concentradas no módulo de contagem e nas notificações: `CountingPlanList.vue:39` (`bg-blue-600 hover:bg-blue-700` no botão "Novo Plano", onde o resto do sistema usaria `<Button>`), `:96` (spinner), `:147` (link "Editar"); `CountingDashboard.vue:38,61,66`; `CountingSessionExecute.vue:34,45,64,78,121`; `NotificationsView.vue:264`; `PCPDashboardView.vue:29-30`; `AppHeader.vue:9,22`. O `primary-600` (#4a6b7c, azul-ardósia da logo) e o `blue-600` do Tailwind (#2563eb) são visivelmente cores diferentes — não é um detalhe invisível.

**Desvio 2 — `text-success-600` não existe.** Dez ocorrências de uma classe que **não está definida** em `tailwind.config.js` (não há `success` na paleta): `MRPView.vue:65`, `StockView.vue:59`, `ReportsView.vue:133,162,171,183,220,299,360,400`. O Tailwind não gera a regra, o texto herda a cor do pai e o número que deveria ser verde sai cinza. É um bug visual silencioso em três telas.

**Cores semânticas ad-hoc que na prática já formam um padrão:** `green` = ativo/sucesso, `red` = inativo/perigo, `yellow` = alerta/ação reversível, `gray` = neutro/rascunho. Isso é consistente entre views (comparar `SuppliersView.vue:98`, `CountingPlanList.vue:303-307`, `UsersListView.vue:116-117`) mas não está tokenizado.

### 2.8 Ícones — ❌ **três sistemas concorrentes e a biblioteca instalada não é usada**

| Sistema | Onde | Volume |
|---|---|---|
| **Emoji Unicode** | `DashboardView.vue:105-343` (todos os ~30 cards de módulo), `StockView.vue:36,39,42,51,58,65,72,79,118,127`, `MRPView.vue:35,43,50,57,64`, `AuditLogsView.vue:149,305,312,320,349,355,360,371,385,399,412,418`, `NotificationsView.vue:48` | Dominante em dashboards e resumos |
| **SVG inline** (path do Heroicons, colado à mão) | `CountingDashboard.vue` (8x), `PCPDashboardView.vue:30-31,48-49,64-65` (4x), `CountingPlanList.vue:41-43,186-188`, `WarehouseStructuresView.vue:265-267`, `NotificationBell.vue`, `CountingSessionReport.vue` | 34 ocorrências de `<svg` no total |
| **Glifo de texto** | `✕` para fechar modal (`WorkCentersView.vue:102`, `SuppliersView.vue:121`), `+` para criar (`SuppliersView.vue:33`), `✓ ✕ ⚠ ℹ` nos toasts (`ToastContainer.vue:44-49`) | ~20 |
| **@heroicons/vue** | — | **0 usos.** Instalado em `package.json:15`, importado em lugar nenhum. |

Não há convenção de tamanho: `w-5 h-5` (`CountingPlanList.vue:41`), `w-6 h-6` (`WarehouseStructuresView.vue:265`), `h-12 w-12` (`CountingPlanList.vue:186`), `text-3xl` para emoji (`DashboardView.vue:105`), `text-2xl` para o `✕`. Também não há distinção outline/solid — todos os SVGs colados são outline (`fill="none" stroke="currentColor"`), o que ao menos é uniforme por acidente.

Nota: `components/common/Input.vue:22-24` aceita um ícone via prop `icon` (`<component :is="icon">`) — mecanismo pronto e nunca usado, porque nenhum consumidor do `Input` passa ícone.

### 2.9 Acessibilidade — ⚠️ **a correção da Fase 5 ficou isolada em uma tela**

A auditoria da Fase 5 corrigiu `views/work-centers/WorkCentersView.vue` e essa view é hoje a única do sistema com acessibilidade básica correta:

- **`for`/`id` em todos os campos:** 11 de 11 labels (`:31,35,45,112,121,124,125,127` — ids `wc-filter-search`, `wc-form-code`, etc.).
- **`aria-label` no botão de fechar** (`:102`).
- **Fechamento por Esc, com listener registrado e removido** (`:183-187`).

**Comparação direta com as views irmãs, que resolvem exatamente o mesmo problema:**

| View | Labels no arquivo | Labels com `for=` |
|---|---|---|
| `work-centers/WorkCentersView.vue` | 11 | **11** |
| `products/ProductsView.vue` | 20 | 1 |
| `suppliers/SuppliersView.vue` | 15 | 1 |
| `warehouses/WarehousesView.vue` | 15 | 1 |
| `customers/CustomersView.vue` | 15 | 1 |
| `purchases/PurchaseOrdersView.vue` | 16 | 0 |
| `stock/StockView.vue` | 13 | 0 |
| `warehouse-structures/WarehouseStructuresView.vue` | 13 | 1 |
| `components/users/UserFormModal.vue` | 6 | 1 |

(O único `for=` que sobrevive nessas views é o do checkbox `Ativo`, herdado do template copiado — ex. `SuppliersView.vue:189-190`, `WarehousesView.vue:168-169`.)

**Atributos ARIA em todo o frontend:** apenas 4 ocorrências — `WorkCentersView.vue:102`, `ConfirmDialogContainer.vue:12,13`, `ToastContainer.vue:17`. **`role=`:** apenas 2 — `ToastContainer.vue:8` (`role="status"`) e `ConfirmDialogContainer.vue:11` (`role="alertdialog"`).

**Foco em modal:** `ConfirmDialogContainer.vue:55-89` faz o trabalho completo — guarda o elemento anteriormente focado, foca o botão Cancelar ao abrir, devolve o foco ao fechar, e implementa focus trap em Tab/Shift+Tab. **Nenhum outro modal do sistema faz nada disso.** Abrir o modal de cadastro de fornecedor deixa o foco no `<body>` e o Tab passeia pela página atrás do overlay.

Pontos positivos gerais: `<th scope="col">` aparece em `WarehousesView.vue:51-59`; `<span class="sr-only">Ações</span>` em `WarehousesView.vue:58`; `alt` correto nas logos.

### 2.10 Camada de dados — ⚠️ **dois clientes HTTP e duas rotas de acesso**

Fora do escopo estrito de UI, mas afeta o esqueleto de qualquer tela nova:

1. **Dois clientes axios.** `services/api.service.ts` é o principal (usa `authStore` para o token, tem refresh de token, guarda `console.log` atrás de `import.meta.env.DEV`) e é usado por 27 services. `services/api.ts` é uma versão mais antiga (lê `localStorage` direto em `:12`, sem refresh, `baseURL` diferente em `:5`) e ainda é usado por `services/counting.service.ts` e `services/storage-position.service.ts` — justamente o service de posição de armazenagem que as telas do WMS vão consumir.
2. **View → store (Pinia) vs. view → service direto.** A maioria vai pela store (27 views importam de `@/stores/`). Três views chamam o service diretamente e mantêm o estado localmente: `UsersListView.vue:190` (`userService`), `RolesListView.vue:142` (`roleService`), `AuditLogsView.vue:433` (`auditLogService`). Não há regra escrita para escolher.

---

## 3. Inconsistências encontradas

Lista objetiva, ordenada por impacto sobre as telas novas. Cada item tem pelo menos dois exemplos do **mesmo** problema resolvido de formas diferentes.

| # | Inconsistência | Exemplo A | Exemplo B | Impacto |
|---|---|---|---|---|
| **I1** | **Layout da aplicação duplicado em 26 arquivos** em vez de um componente | `SuppliersView.vue:3-24` + `handleLogout` em `:311-314` | `WorkCentersView.vue:3-17` + `handleLogout` em `:234` | Alto — cada tela nova do WMS nasce com mais uma cópia |
| **I2** | **Ações de linha de tabela: 4 estilos** | `SuppliersView.vue:103-107` (link `text-primary-600`) | `PurchaseOrdersView.vue:103-111` (`<Button size="sm">`); `CountingPlanList.vue:145-150` (link `text-blue-600`); `RolesListView.vue:96-113` (pílulas) | Alto — visível lado a lado |
| **I3** | **Estado de carregamento: 3 variantes** | `SuppliersView.vue:67` (texto) | `CountingPlanList.vue:96` (spinner azul); `PurchaseOrdersView.vue:59-60` (spinner primary + texto) | Médio |
| **I4** | **Overlay de modal: 4 implementações** | `WorkCentersView.vue:97` (`bg-black bg-opacity-50 flex …`) | `PurchaseOrdersView.vue:121` (`bg-gray-600 … h-full w-full` + `top-20`); `BomManagerModal.vue:4` (`bg-black/50`); `ProductSelectorModal.vue:2-4` (backdrop em 2 camadas) | Médio |
| **I5** | **Contrato de modal: `isOpen`+`@close` vs `v-model`** | `UserFormModal.vue:162-170`, consumido em `UsersListView.vue:177-182` | `BomManagerModal.vue:291-298`, consumido em `ProductsView.vue:103` | Alto — decisão obrigatória em toda tela nova com modal |
| **I6** | **Acessibilidade de formulário aplicada em 1 tela de 10** | `WorkCentersView.vue:31,35,45,106-127` — 11/11 labels com `for` | `SuppliersView.vue:127-190` — 1/15; `ProductsView.vue:116-119` — 1/20; `PurchaseOrdersView.vue` — 0/16 | Alto |
| **I7** | **Paginação: 3 formas + ausência na maioria** | `UsersListView.vue:146-172` (Anterior/Próxima com `<Button>`) | `NotificationsView.vue:250-276` (números, `bg-blue-600`); `SuppliersView.vue:227` (`limit: 100`, sem UI) | Alto para o WMS (fila de tarefas, saldo por posição) |
| **I8** | **`blue-*` concorrendo com `primary-*`** | `WorkCentersView.vue:86` (`text-primary-600`) | `CountingPlanList.vue:147` (`text-blue-600`) para o mesmo link "Editar"; `CountingPlanList.vue:39` (`bg-blue-600`) para o mesmo botão "Novo" | Médio — visível |
| **I9** | **`text-success-600` não existe na paleta** — classe sem efeito | `StockView.vue:59` | `MRPView.vue:65`; `ReportsView.vue:133,162,171,183,220,299,360,400` | Baixo-médio (bug visual real, 3 telas) |
| **I10** | **Erro de requisição: toast vs. `console.error` mudo** | `WorkCentersView.vue:211-213` (`toast.error(...)`) | `CountingPlanList.vue:242-244` e `:250-253` (só `console.error`, usuário não vê nada) | Alto — falha silenciosa |
| **I11** | **Estado de erro de tela existe em 1 view** | `PCPDashboardView.vue:12-15` (faixa + `Tentar Novamente`) | Todas as demais tratam falha como "lista vazia" — ex. `SuppliersView.vue:70-72` mostra "Nenhum fornecedor encontrado" tanto para lista vazia quanto para API fora do ar | Médio |
| **I12** | **Estado vazio: 3 níveis de qualidade** | `SuppliersView.vue:71` (texto) | `CountingPlanList.vue:185-191` (SVG + título + ajuda); `ProductionOrdersView.vue:69-72` (texto + CTA) | Baixo |
| **I13** | **Ícones: emoji vs SVG inline vs glifo**, com Heroicons instalado e não usado | `DashboardView.vue:105` (`👥`), `StockView.vue:36` (`⬆️ Entrada`) | `CountingDashboard.vue:66-68` (SVG colado); `package.json:15` (Heroicons, 0 imports) | Médio |
| **I14** | **`getStatusClass`/`formatStatus` reimplementados 9x** | `CountingPlanList.vue:290-310` | `ProductionOrdersView.vue:310`; `PurchaseOrdersView.vue:345`; `AuditLogsView.vue:551`; +5 | Médio |
| **I15** | **Dois clientes axios ativos** | `services/api.service.ts` (27 services, com refresh de token) | `services/api.ts` (`counting.service.ts`, `storage-position.service.ts` — sem refresh) | Médio para o WMS (o service de posição está no cliente antigo) |
| **I16** | **Acesso a dados: store vs. service direto** | `SuppliersView.vue:208` (`useSupplierStore`) | `UsersListView.vue:190` (`userService` direto); `RolesListView.vue:142`; `AuditLogsView.vue:433` | Baixo-médio |
| **I17** | **`<script setup>` sem `lang="ts"`** | 42 SFCs com `lang="ts"` | `WarehousesView.vue:183`; `WarehouseStructuresView.vue` | Baixo, mas `WarehousesView.vue` perde checagem justamente numa tela do domínio WMS |
| **I18** | **Código morto** | `components/AppHeader.vue` (0 importações), `views/HomeView.vue` (sem rota), `@heroicons/vue` (0 imports) | `WarehousesView.vue:198` — o `search` do input em `:42` nunca é passado a `loadWarehouses()` (`:222-230`): o campo de busca da tela de armazéns **não busca nada** | Médio (o filtro morto é bug de produto) |

**Categorias onde o padrão JÁ é consistente e não precisa de intervenção** — registrado explicitamente para não gerar trabalho inventado:

- **Composition API / `<script setup>`:** 44 de 44 SFCs. Zero divergência.
- **`alert()` / `confirm()` nativos:** zero ocorrências. Migração da Fase 5 100% concluída.
- **Markup de `<table>`/`<thead>`/`<tbody>`:** mesmas classes em ~15 views.
- **Badge de status:** mesmo par de classes em todo o sistema (o que varia é a *função* que o escolhe, I14, não o visual).
- **Título e subtítulo da página:** `text-3xl font-bold text-gray-900` + `mt-1 text-sm text-gray-600` em 23 views.
- **Largura e respiro do conteúdo:** `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8` em 25 de 26 views com header (exceção: `PCPDashboardView.vue:4`).
- **`useDebounce` na busca:** mesmo idioma (`350ms` no `@input`) nas 11 views que o usam.
- **CSS customizado:** praticamente inexistente — só a transição do `ToastContainer`. Não há folha de estilo paralela ao Tailwind.
- **Grade de formulário:** `grid grid-cols-2 gap-4` / `grid-cols-3 gap-4` dentro de `<form class="space-y-4">` em todos os modais de cadastro.

---

## 4. O padrão proposto daqui pra frente

Regra geral: **entre duas variantes existentes, vence a mais adotada; entre uma mais adotada e uma claramente melhor, vence a melhor e a mais adotada é migrada quando o arquivo for tocado por outro motivo.** Não há refatoração em massa prevista neste documento — o objetivo é que nada *novo* nasça fora do padrão.

### 4.1 Quando extrair um componente vs. quando repetir Tailwind

**Extrair** quando pelo menos um for verdadeiro:
1. O mesmo bloco aparece em **3 ou mais arquivos** com a mesma semântica (não só as mesmas classes por coincidência).
2. O bloco carrega **comportamento**, não só aparência (foco, Esc, teclado, ARIA, debounce).
3. Errar o bloco é **invisível para quem revisa** — é exatamente o caso de `for`/`id`, `aria-label` e focus trap: um componente acerta uma vez para sempre.

**Repetir Tailwind é aceitável** quando: o bloco é usado em 1–2 lugares; é layout específico da tela (uma grade de 5 colunas para os cards de resumo do estoque); ou a abstração exigiria mais props do que o HTML tem linhas.

**Componentes a criar (em ordem de retorno), todos em `components/common/`:**

| Componente | Substitui | Justificativa |
|---|---|---|
| `AppLayout.vue` | I1 — 26 cópias de `<header>` + `handleLogout` | Slot `default` para o conteúdo; props `title` e `subtitle`; slot `actions` para a ação primária. Absorve o `PCPDashboardView` que hoje não tem header nenhum. Ponto único para o menu por módulo do WMS (§5.1). |
| `FormField.vue` | I6 + a string de 88 caracteres repetida ~130x | Gera `id` automático (ex. `useId()` manual por contador), aplica `for`, marca obrigatório, exibe erro por campo. **É a correção estrutural de acessibilidade** — evita depender de disciplina por tela. |
| `DataTable.vue` (ou `TableShell.vue`) | I3, I7, I11, I12 | Encapsula `loading` / `error` / `empty` / paginação em um só lugar. Slots `head`, `row`, `empty`. |
| `AppModal.vue` | I4, I5 + falta de Esc e focus trap fora do `ConfirmDialogContainer` | Contrato único (§4.4). Reaproveita a lógica de foco de `ConfirmDialogContainer.vue:55-89`, que já está correta. |
| `StatusBadge.vue` | I14 | Props `label` + `tone` (`success`/`danger`/`warning`/`neutral`/`info`), mapeando para os pares `bg-X-100 text-X-800` já usados. |
| `PageHeader.vue` | — | Opcional, se `AppLayout` não absorver via props. |

**Componentes existentes que ficam como estão:** `Button.vue` (bom, adotado), `Card.vue` (bom, adotado), `ToastContainer.vue`, `ConfirmDialogContainer.vue`. `Input.vue` é substituído na prática por `FormField.vue` — ou `FormField` é construído *sobre* ele; o que não pode continuar é ter os dois com 2 consumidores no total.

### 4.2 Escolhas canônicas (a variante que vence, entre as que já existem)

| Categoria | **Padrão oficial** | Origem | O que fica proibido em código novo |
|---|---|---|---|
| Cor primária | `primary-*` do `tailwind.config.js` | 528 usos | `blue-*` para elementos de marca/ação (I8) |
| Cor semântica | `green` sucesso, `red` perigo, `yellow` alerta, `gray` neutro | consenso de fato | `text-success-*`, `bg-success-*` — **classe inexistente** (I9). Enquanto não houver alias `success` no config, usar `green-600`. |
| Ação de linha | Link de texto `text-primary-600 hover:text-primary-900` (destrutiva: `text-red-600 hover:text-red-900`) | `SuppliersView.vue:103-107`, dominante | `<Button size="sm">` em célula de tabela (I2) |
| Botão "novo" | `<Button @click="openCreateModal"><span class="mr-2">+</span>Novo X</Button>` | `SuppliersView.vue:32-35` | `<RouterLink>` estilizado à mão como botão (`CountingPlanList.vue:37-45`) |
| Loading | Spinner **em `primary`** + texto: `<div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div><p class="mt-2 text-gray-600">Carregando...</p>` | `PurchaseOrdersView.vue:59-60` — variante C, escolhida por ser a mais informativa e já estar em `primary` | Texto puro; spinner `blue-600` |
| Empty state | Ilustração/ícone + título + frase de ajuda + **CTA quando houver ação** | `CountingPlanList.vue:185-191` (forma) + `ProductionOrdersView.vue:69-72` (CTA) | Só `<p>Nenhum X encontrado</p>` |
| Erro de tela | Faixa `bg-red-50 border border-red-200 rounded-lg p-6` + mensagem + `Tentar Novamente` | `PCPDashboardView.vue:12-15` — única existente, e está certa | Colapsar falha em empty state |
| Overlay de modal | `fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4` | dominante, ~16 usos | as outras 3 variantes (I4) |
| Caixa de modal | `bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto` + `@click.stop` | dominante | `relative top-20 mx-auto` (compras) |
| Fechar modal | Botão com `aria-label="Fechar"` + Esc + clique no overlay + focus trap | `WorkCentersView.vue:102,181-187` + `ConfirmDialogContainer.vue:55-89` | modal sem Esc e sem gestão de foco |
| Paginação | Contador "Mostrando X a Y de Z" + `Anterior`/`Próxima` com `<Button variant="outline" size="sm">` | `UsersListView.vue:146-172` (idêntico em 3 views) | paginação numerada com `<button>` cru; `limit: 100` sem UI |
| Formulário | `<form @submit.prevent="handleSubmit" class="space-y-4">` + `grid grid-cols-2 gap-4` + rodapé `Cancelar` (outline) / `Salvar` (primary), ambos `class="flex-1"` | universal nos cadastros | — |
| Obrigatório | `<span class="text-red-500">*</span>` (via `FormField`) | `CountingPlanForm.vue:48`, `Input.vue:5` | asterisco literal no texto do label |
| Ícones | **SVG inline outline** (`fill="none" stroke="currentColor"`), `w-5 h-5` em botões/linhas, `w-6 h-6` em cabeçalhos, `h-12 w-12` em empty state | `CountingPlanList.vue:41-43,186-188` | **Emoji como ícone funcional** (I13). Emoji continua tolerado apenas nos cards de módulo do `DashboardView`, que é decorativo. |
| Cliente HTTP | `services/api.service.ts` | 27 services, tem refresh de token | `services/api.ts` (I15) |
| Acesso a dados | View → **store Pinia** → service | 27 views | service direto na view, exceto tela de leitura pura sem estado compartilhado |
| TypeScript | `<script setup lang="ts">` sempre | 42/44 | `<script setup>` sem `lang` |
| Log | `console.log` só dentro de `if (import.meta.env.DEV)` | `App.vue:21-33`, `api.service.ts:32` | log solto (`DashboardView.vue:110-135`, `LoginView.vue:151-162`) |

**Sobre Heroicons (I13):** a dependência está instalada e não usada. Duas saídas honestas — (a) adotar `@heroicons/vue/24/outline` de verdade e migrar os SVGs colados à medida que os arquivos forem tocados, ou (b) removê-la do `package.json`. **Recomendação: (a)**, porque os SVGs colados hoje *já são* paths do Heroicons — trocar `<svg>...</svg>` por `<PlusIcon class="w-5 h-5" />` reduz ruído e padroniza tamanho. Mas a decisão precisa ser tomada; deixar a dependência instalada e não usada é a pior das três opções.

### 4.3 Convenção de nomes

Já é seguida na prática; fica registrada.

- **Views:** `PascalCase` + sufixo. `XxxView.vue` para tela única de recurso (`SuppliersView.vue`, `StockView.vue`); `XxxListView.vue` / `XxxFormView.vue` quando listagem e formulário são rotas separadas (`UsersListView.vue`, `CountingPlanList.vue`, `CountingPlanForm.vue`). O módulo de contagem omite o sufixo `View` (`CountingDashboard.vue`, `CountingSessionExecute.vue`) — **em código novo, manter o sufixo**.
- **Pasta:** `views/<dominio-kebab>/` — `warehouse-structures/`, `work-centers/`, `purchases/`. Telas novas do WMS vão em pastas novas do mesmo formato (`views/receiving/`, `views/warehouse-tasks/`, `views/stock-positions/`).
- **Componentes:** `components/common/` para o que serve a todo o sistema; `components/<dominio>/` para o resto. Modais terminam em `Modal.vue`.
- **Rotas:** `name` em kebab-case igual ao path (`work-centers`, `counting-plan-new`), path em kebab-case.
- **Stores:** `<recurso>.store.ts` com `use<Recurso>Store`. **Services:** `<recurso>.service.ts`. (Exceção existente: `services/countingPlanProductService.ts`, em camelCase — não replicar.)
- **Handlers:** `handleSubmit`, `handleDelete`, `handleFilterChange`, `openCreateModal`, `openEditModal`, `closeModal`, `load<Recurso>s`. Já é universal.

### 4.4 Contrato mínimo de uma tela CRUD nova

Toda view de listagem + formulário **deve** ter, sem exceção:

1. `<script setup lang="ts">`.
2. Envelopada em `AppLayout` (ou, enquanto ele não existir, o header exato de `SuppliersView.vue:3-24`) com `title` e `subtitle`.
3. Ação primária no canto superior direito, com `<Button>`.
4. Filtros em `<Card class="mb-6">`, com a busca textual em `@input="debouncedFilterChange"` (**`useDebounce` é obrigatório em qualquer campo de busca que dispare requisição** — I18 mostra o que acontece quando o filtro é decorativo).
5. Os **quatro** estados da listagem, distintos: `loading`, `error` (com retry), `empty` (com CTA quando houver ação), `dados`. Colapsar erro em vazio não é aceitável.
6. **Paginação sempre que a API pagina.** Se o volume for realmente pequeno e conhecido, isso precisa estar escrito em comentário — não implícito num `limit: 100`.
7. **Todo campo com `label` associado por `for`/`id`.** Sem exceção. Esta é a regra que a Fase 5 acertou em uma tela e que precisa parar de ser opcional.
8. Modal: Esc fecha, clique no overlay fecha, foco entra no modal ao abrir e volta ao fechar, botão de fechar com `aria-label="Fechar"`.
9. **`useToast` obrigatório** em todo caminho de escrita: sucesso (`toast.success('X criado com sucesso!')`) e falha (`toast.error(error.response?.data?.message || 'Erro ao ...')`). **`console.error` sozinho num `catch` é proibido** — se quiser logar, logue *e* avise o usuário (I10).
10. **`confirmDialog` obrigatório** antes de qualquer ação destrutiva ou irreversível (exclusão, cancelamento, ajuste de estoque, conclusão de sessão).
11. Acesso a dados via store Pinia.
12. Nenhum `console.log` fora de `import.meta.env.DEV`.

### 4.5 Esqueleto de uma view nova

```vue
<template>
  <AppLayout title="Tarefas de Armazém" subtitle="Fila de tarefas do armazém">
    <template #actions>
      <Button @click="openCreateModal"><span class="mr-2">+</span>Nova Tarefa</Button>
    </template>

    <Card class="mb-6">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <FormField id="wt-search" label="Buscar" class="md:col-span-2">
          <input v-model="filters.search" type="text" placeholder="Código ou endereço..."
                 class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                 @input="debouncedFilterChange" />
        </FormField>
        <FormField id="wt-status" label="Status">
          <select v-model="filters.status" @change="handleFilterChange" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500">
            <option value="">Todos</option>
          </select>
        </FormField>
      </div>
    </Card>

    <DataTable :loading="loading" :error="error" :items="tasks" :pagination="pagination"
               empty-title="Nenhuma tarefa encontrada"
               empty-hint="As tarefas aparecem aqui quando um recebimento é criado."
               @retry="loadTasks" @change-page="changePage">
      <template #head>
        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código</th>
        <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
      </template>
      <template #row="{ item }">
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ item.code }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
          <button @click="openEditModal(item)" class="text-primary-600 hover:text-primary-900">Editar</button>
          <button @click="handleDelete(item)" class="text-red-600 hover:text-red-900">Excluir</button>
        </td>
      </template>
    </DataTable>

    <AppModal v-model="showModal" :title="editing ? 'Editar Tarefa' : 'Nova Tarefa'">
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <FormField id="wt-code" label="Código" required>
            <input v-model="formData.code" type="text" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
          </FormField>
        </div>
        <div class="flex gap-3 pt-4">
          <Button type="button" variant="outline" @click="closeModal" class="flex-1">Cancelar</Button>
          <Button type="submit" :disabled="saving" class="flex-1">{{ editing ? 'Salvar' : 'Criar' }}</Button>
        </div>
      </form>
    </AppModal>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AppLayout from '@/components/common/AppLayout.vue'
import Button from '@/components/common/Button.vue'
import Card from '@/components/common/Card.vue'
import DataTable from '@/components/common/DataTable.vue'
import AppModal from '@/components/common/AppModal.vue'
import FormField from '@/components/common/FormField.vue'
import { useToast } from '@/composables/useToast'
import { confirmDialog } from '@/composables/useConfirm'
import { useDebounce } from '@/composables/useDebounce'
import { useWarehouseTaskStore } from '@/stores/warehouse-task.store'

const store = useWarehouseTaskStore()
const toast = useToast()

const tasks = ref([])
const loading = ref(false)
const error = ref('')          // I11: estado de erro é obrigatório, não opcional
const saving = ref(false)
const showModal = ref(false)
const editing = ref(null)
const filters = ref({ search: '', status: '' })
const pagination = ref({ page: 1, limit: 20, total: 0, pages: 0 })

const loadTasks = async () => {
  try {
    loading.value = true
    error.value = ''
    const result = await store.fetchTasks(pagination.value.page, pagination.value.limit, filters.value)
    tasks.value = result.data
    pagination.value = result.pagination
  } catch (e: any) {
    error.value = e.response?.data?.message || 'Erro ao carregar tarefas'
  } finally {
    loading.value = false
  }
}

const handleFilterChange = () => { pagination.value.page = 1; loadTasks() }
const debouncedFilterChange = useDebounce(handleFilterChange, 350)
const changePage = (page: number) => { pagination.value.page = page; loadTasks() }

const handleSubmit = async () => {
  try {
    saving.value = true
    editing.value ? await store.update(editing.value.id, formData.value) : await store.create(formData.value)
    toast.success(editing.value ? 'Tarefa atualizada com sucesso!' : 'Tarefa criada com sucesso!')
    closeModal()
    await loadTasks()
  } catch (e: any) {
    toast.error(e.response?.data?.message || 'Erro ao salvar tarefa')  // nunca só console.error
  } finally {
    saving.value = false
  }
}

const handleDelete = async (task) => {
  if (!(await confirmDialog(`Deseja realmente excluir a tarefa "${task.code}"?`))) return
  try {
    await store.remove(task.id)
    toast.success('Tarefa excluída com sucesso!')
    await loadTasks()
  } catch (e: any) {
    toast.error(e.response?.data?.message || 'Erro ao excluir tarefa')
  }
}

onMounted(loadTasks)
</script>
```

Enquanto `AppLayout`/`DataTable`/`AppModal`/`FormField` não existirem, a alternativa aceitável é copiar **`WorkCentersView.vue`** como base — é a view mais próxima do padrão (única com acessibilidade completa, Esc no modal, `useToast` + `confirmDialog` + `useDebounce`, cores `primary`) — acrescentando o estado de `error`, a paginação e o empty state com CTA que faltam nela.

---

## 5. Aplicação às telas novas do WMS

O backend das Fases 0–5 está pronto (`WMS_IMPLEMENTATION_ANALYSIS.md`); nenhuma das telas abaixo existe. Esta seção **não desenha as telas** — só verifica se o padrão da §4 é suficiente para cada tipo, e aponta o que ainda falta especificar.

### 5.1 Licenciamento e menu por módulo (F0.8)

**Estado atual:** já existe base — `stores/auth.store.ts:24-27` expõe `canViewGeneral/canViewPCP/canViewWMS/canViewYMS` a partir das permissões `modules.view_*`, e `views/DashboardView.vue:46-95` renderiza abas por módulo com esses getters. A aba WMS (`:270-316`) já lista **Recebimento, Localizações, Transferências, Expedição, Picking** como cards `opacity-50 cursor-not-allowed` com "Em breve" — os placeholders das telas que faltam já estão desenhados.

**Padrão suficiente?** ⚠️ **Parcialmente.** O que já existe cobre a aba do dashboard. O que **falta especificar**:

- **Guard de rota por módulo.** `router/index.ts:192-210` só checa autenticação. Precisa de `meta: { module: 'WMS' }` + verificação no `beforeEach`, consumindo `GET /system/licensed-modules` (F0.8). **Não há precedente no código** — é a primeira decisão genuinamente nova.
- **Onde o menu por módulo vive.** Hoje é o dashboard. Com 7+ telas novas de WMS, navegar sempre pelo dashboard fica ruim. O `AppLayout` (§4.1) é o lugar natural para um menu por módulo — mas o formato (barra horizontal? sidebar? dropdown no header?) **não tem precedente e precisa ser decidido**. É a única decisão de layout de verdade que este documento não consegue resolver escolhendo entre variantes existentes, porque não há variante existente.
- **Como comunicar "módulo não licenciado".** O padrão de `PCPDashboardView.vue:12-15` (faixa `bg-red-50` + retry) serve para falha técnica, não para ausência de licença. Sugestão: reusar o card `opacity-50` + "Em breve" que já existe no `DashboardView`, trocando o texto — mas fica como ponto aberto.

### 5.2 Dados de armazenagem no formulário de produto (F0.9)

**Tipo:** formulário com seção condicional (peso, volume, empilhamento, segregação — visível só com WMS licenciado).

**Padrão suficiente?** ✅ **Sim, com precedente direto.** `WarehouseStructuresView.vue:215-245` já faz exatamente isso: uma seção só renderizada em modo de edição, delimitada por `border-t pt-4 mt-4`, com fundo `bg-blue-50 p-4 rounded-lg`, título `<h4 class="text-sm font-semibold">`, texto explicativo e botões próprios. Trocar `v-if="editingStructure"` por `v-if="authStore.canViewWMS"` é a mesma mecânica. Ajuste ao padrão: usar `bg-primary-50` em vez de `bg-blue-50` (I8).

O formulário de produto que recebe a seção é `views/products/ProductsView.vue:107-...` — hoje com 20 labels e 1 `for=` (I6). **Se a seção nova for adicionada sem `FormField`, o problema de acessibilidade cresce em vez de diminuir.**

### 5.3 Saldo por posição (F1.6) e ocupação da estrutura

**Tipo:** aba nova em `StockView.vue` + visualização em `WarehouseStructuresView.vue`.

**Padrão suficiente?** ✅ **Sim.** Abas têm três implementações consistentes entre si (`DashboardView.vue:46-95`, `MRPView.vue:74-97`, `ReportsView.vue:64`, `PermissionsModal.vue:37`), todas com `border-b-2` + `border-primary-500 text-primary-600` no ativo. Escolher a de `MRPView.vue:74-97` como canônica (é a mais simples e já usa `primary`).

**Ponto de atenção real:** `StockView.vue` é a view com mais desvios acumulados — `text-success-600` inexistente (`:59`), emoji como ícone de ação (`:36,39,42,118`), spinner de emoji (`:127`), 13 labels com 0 `for=`. Adicionar uma aba ali **sem** corrigir o entorno consolida os desvios. Recomendação: ao tocar `StockView.vue` para F1.6, corrigir `text-success-600` → `text-green-600` no mesmo commit (é uma linha).

### 5.4 Transferência entre endereços (F2.5)

**Tipo:** formulário de operação com busca de posição por código (`GET /storage-positions/by-code/:code`, F0.2).

**Padrão suficiente?** ⚠️ **Quase.** O formulário em si é coberto. O que **falta especificar** é o **campo de busca por código com resolução assíncrona** (digita/escaneia `ARM-RUA-AA-PP`, o sistema resolve e mostra a posição). O que existe de mais próximo é `components/counting/ProductSelectorModal.vue`, que faz busca em modal com filtro **client-side** (`:95-96`), sobre uma lista já carregada — não é a mesma coisa. `useDebounce` cobre a mecânica de espera, mas o comportamento visual (o que mostrar enquanto resolve, como exibir "código não encontrado", como confirmar a leitura) **não tem precedente**. É o segundo ponto aberto real.

Além disso, `services/storage-position.service.ts` usa o cliente HTTP antigo (`services/api.ts`, I15) — migrar para `api.service.ts` antes de construir as telas do WMS sobre ele.

### 5.5 Tela de recebimento (F4.12) — a primeira do sistema

**Tipo:** listagem de recebimentos + tela de conferência (linha a linha, com `acceptedQty`, e a partir da Fase 5 também `lotNumber`/`manufacturedAt`/`expiresAt` quando `product.lotTracked`).

**Padrão suficiente?** ✅ **Sim, com precedentes fortes.** A listagem é o arquétipo CRUD padrão. A conferência linha a linha, com quantidade digitada e divergência calculada, já tem uma implementação madura: `views/counting/CountingSessionExecute.vue:57-95` — quantidade do sistema, campo grande de entrada, alerta de divergência com cor condicional (`:85-95`), observações, ações Pular/Confirmar. A captura de lote e validade se encaixa como campos condicionais no mesmo bloco (mesmo mecanismo condicional de §5.2).

**Ressalva de padrão:** `CountingSessionExecute.vue` é a view com **mais** desvios de cor (`bg-blue-600` em `:34,121`, `border-blue-600` em `:45,78`, `text-blue-600` em `:64`) e usa `<button>` cru em vez de `<Button>` (`:112-124`, `:130-147`, `:159-165`). Ao usá-la como referência de **estrutura**, trocar cor e botões pelo padrão da §4.2.

### 5.6 Fila de tarefas de armazém (F4.9, F4.12)

**Tipo:** lista/Kanban de `WarehouseTask` por operador e painel de acompanhamento do supervisor.

**Padrão suficiente?** ⚠️ **Suficiente para a versão em lista; insuficiente para Kanban.**

- **Como lista com filtros por tipo/status/operador + badge de status + ações por linha:** totalmente coberto pelo arquétipo CRUD (§4.4). É a recomendação — nascer como lista, não como Kanban.
- **Como Kanban (colunas por status, arrastar entre colunas):** **não há nada parecido no sistema.** Zero colunas arrastáveis, zero drag-and-drop, zero dependência que o forneça. Seria a primeira interação desse tipo — decisão de produto, com custo real, não uma variação do padrão.
- **Painel do supervisor com contadores por status:** coberto — grade de `<Card>` com número grande, exatamente como `StockView.vue:48-84`, `MRPView.vue:40-69` e `CountingDashboard.vue:55-120` já fazem (usando a variante com `<Card>`, não a de `div` cru, e sem `text-success-600`).
- **Atualização em tempo real da fila:** não especificado. Não há polling nem WebSocket em nenhuma tela; `NotificationBell.vue` é o único candidato a precedente e vale checar antes de decidir.

### 5.7 Contagem com endereço e rota (F3.5)

**Tipo:** alteração de `CountingSessionExecute.vue` para exibir o endereço, seguir a sequência de rota serpentina (`CountingItem.sequence`, F3.3) e permitir busca de item por código de posição.

**Padrão suficiente?** ✅ **Sim.** A view já exibe `currentItem.location?.code` (`:60`) — a troca para `storagePosition.code` é de campo, não de layout. A barra de progresso (`:27-38`) e a navegação por item (`:250-262`) permanecem. A busca por código de posição é a mesma lacuna de §5.4.

### 5.8 Tela mobile para coletor (F4.11)

**Status no plano:** explicitamente **fora de escopo** de `WMS_IMPLEMENTATION_ANALYSIS.md` (item F4.12: "Frontend mobile/PWA para o operador fica fora deste documento — é decisão de produto separada"). O risco já estava registrado ali ("Escopo do frontend mobile/PWA ficar subestimado por não ter sido desenhado").

**Padrão suficiente?** ❌ **Não, e este documento não deveria fingir que sim.** O que existe:

- **Único precedente real de tela orientada a operação:** `CountingSessionExecute.vue` — `<main class="px-4 py-6">` sem `max-w-7xl` (`:41`), campo de quantidade grande e centralizado (`:78`, `text-2xl text-center border-2 py-3`), botões de ação em largura total (`:111-125`), atalhos rápidos Zero/Sistema/Limpar (`:129-148`), barra de progresso (`:27-38`). É genuinamente uma boa base de UI de coletor.
- **Responsividade:** só duas views usam breakpoints além do padding — `PCPDashboardView.vue` (`sm:` em texto, ícone e grade) e `CountingSessionExecute.vue`. As outras 26 são desktop com `max-w-7xl`, e as tabelas dependem de `overflow-x-auto`.

**O que falta especificar (e não pode ser derivado do que existe):** tamanho mínimo de alvo de toque; integração com leitor de código de barras/scanner (nenhuma tela lê scanner hoje); comportamento offline/fila de sincronização; se é PWA, app nativo ou navegador do coletor; se compartilha `AppLayout` ou tem um layout mobile próprio (provavelmente próprio — logo + saudação + "Sair" desperdiçam a tela de um coletor). **Recomendação: um documento próprio para o frontend de coletor**, tendo `CountingSessionExecute.vue` como ponto de partida de UI e este documento como base de convenções de código (nomes, composables obrigatórios, cliente HTTP, TypeScript).

### 5.9 Resumo da cobertura

| Tela do WMS | Coberta pelo padrão da §4? | Falta especificar |
|---|---|---|
| Dados de armazenagem no produto (F0.9) | ✅ Sim | — |
| Saldo por posição / ocupação (F1.6) | ✅ Sim | — |
| Contagem com endereço e rota (F3.5) | ✅ Sim | busca por código de posição (§5.4) |
| Recebimento e conferência (F4.12) | ✅ Sim | — |
| Fila de tarefas — **como lista** (F4.9) | ✅ Sim | atualização em tempo real |
| Painel do supervisor (F4.12) | ✅ Sim | — |
| Menu e guard por módulo (F0.8) | ⚠️ Parcial | **guard de rota por módulo; formato e local do menu; UI de "não licenciado"** |
| Transferência entre endereços (F2.5) | ⚠️ Parcial | **campo de busca de posição por código com resolução assíncrona** |
| Fila de tarefas — **como Kanban** | ❌ Não | drag-and-drop entre colunas — sem precedente e sem dependência |
| Coletor mobile (F4.11) | ❌ Não | **documento próprio** — toque, scanner, offline, PWA vs. nativo, layout |

---

## 6. Ordem sugerida de adoção

Sem refatoração em massa. A regra é: **código novo nasce no padrão; código antigo migra quando for tocado por outro motivo.**

| # | Ação | Custo | Desbloqueia |
|---|---|---|---|
| 1 | Criar `AppLayout.vue` e usá-lo nas telas novas do WMS | 1 dia | Menu por módulo (§5.1), fim de I1 |
| 2 | Criar `FormField.vue` | 0,5 dia | I6 estruturalmente, em vez de por disciplina |
| 3 | Criar `AppModal.vue` (contrato `v-model`, Esc, focus trap portado de `ConfirmDialogContainer.vue:55-89`) | 1 dia | I4, I5 |
| 4 | Criar `DataTable.vue` com os 4 estados + paginação canônica | 1,5 dia | I3, I7, I11, I12 |
| 5 | Decidir Heroicons: adotar ou remover do `package.json` | 0,5 dia (decisão) | I13 |
| 6 | Corrigir `text-success-600` → `text-green-600` (10 ocorrências, 3 arquivos) | 15 min | I9 — bug visual real |
| 7 | Corrigir o filtro morto de `WarehousesView.vue` e adicionar `lang="ts"` | 30 min | I18, I17 |
| 8 | Migrar `storage-position.service.ts` e `counting.service.ts` para `api.service.ts` | 0,5 dia | I15, antes de as telas do WMS consumirem |
| 9 | Adicionar `toast.error` nos `catch` mudos do módulo de contagem | 1 h | I10 |
| 10 | Remover código morto (`components/AppHeader.vue`, `views/HomeView.vue`) | 15 min | I18 |
| 11 | Decidir formato do menu por módulo e do guard de rota | decisão de produto | §5.1 |
| 12 | Documento próprio para o frontend de coletor | decisão de produto | §5.8 |

Itens 6, 7, 9 e 10 são correções de minutos com efeito verificável e podem entrar em qualquer commit. Os itens 1–4 são pré-requisito prático para que as ~8 telas do WMS não repliquem 8 vezes mais os problemas I1, I4, I5, I6, I7 e I11.

---

## 7. Base da verificação

- **Views:** 28 arquivos em `frontend/src/views/` — todas abertas; 15 lidas integralmente, 13 lidas em trechos estruturais (cabeçalho, filtros, tabela, modal, script) complementados por buscas dirigidas.
- **Componentes:** 16 arquivos em `frontend/src/components/` — `common/` (5) e `AppHeader.vue` lidos integralmente; os 10 modais de domínio lidos em template e contrato de props/emits.
- **Infraestrutura:** `src/App.vue`, `src/router/index.ts`, `src/composables/` (3), `src/services/api.ts`, `src/services/api.service.ts`, `src/stores/auth.store.ts`, `frontend/tailwind.config.js`, `frontend/src/style.css`, `frontend/package.json`.
- **Buscas de contagem** usadas para as afirmações quantitativas: `alert(`, `confirm(`, `heroicons`, `sortBy|orderBy|sortOrder`, `blue-[0-9]00` vs `primary-[0-9]00`, `text-success-`, `fixed inset-0`, `<label ... for=` vs `<label`, `aria-`, `role=`, `Carregando|animate-spin`, `<script setup>` vs `<script setup lang="ts">`, `AppHeader`, `console.error`, `console.log`, `response?.data?.message`, `getStatusClass`.
- **Documentos cruzados:** `03_DECISAO_STACK_FRONTEND.md` (correção registrada em §1.1), `04_ARQUITETURA_MODULAR_LICENCIAMENTO.md` (§5.1), `WMS_IMPLEMENTATION_ANALYSIS.md` fases 0–5 (§5).
