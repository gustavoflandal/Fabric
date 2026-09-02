# Permissões do Sistema Fabric

**Última atualização:** 02/09/2026 (revisão 3 — cadastros de apoio nos perfis padrão e fim do recurso `storage_positions`)
**Fonte de verdade usada na revisão original:** tabela `permissions` consultada ao vivo no MySQL (`fabric-mysql`, banco `fabric`) **cruzada** com todo `requirePermission('recurso', 'ação')` encontrado em `backend/src/routes/*.routes.ts`.

> Este documento substitui integralmente a versão anterior a esta faxina, que afirmava "47 permissões" — número desatualizado desde que os módulos de Compras, Armazém e Contagem de Estoque foram adicionados via scripts avulsos em vez de atualização do `seed.ts`. Os arquivos `PERMISSOES_APROVACAO_COMPRAS.md`, `PERMISSOES_COMPRAS.md`, `PERMISSOES_MODULOS.md` e mais dois documentos redundantes (que divergiam entre si, um citando 47 e outro 74 permissões) foram removidos por serem contraditórios entre si e com o banco real.

> **Revisão 2:** a revisão original desta faxina (mesmo dia) documentou um gap real de autorização — a maior parte do PCP básico não tinha checagem granular de permissão, e `MANAGER`/`OPERATOR` estavam com zero permissões atribuídas. Isso foi corrigido no commit `f31a674` (branch `fix-rbac-pcp-manager-operator`, ainda não mesclada em `main` no momento desta edição). Esta revisão atualiza o documento para descrever o estado **já corrigido**. Se você está lendo isto e a branch de correção ainda não foi mesclada, confira `git log` antes de confiar cegamente nas seções 2 e 3 abaixo.

> **Revisão 3 (02/09/2026):** entre a revisão 2 e esta, as Fases do WMS já haviam fechado boa parte da lista da seção 3 — `dashboard`, `unit-of-measure`, `product-category`, `counting-plan-product` e `counting-assignment` **já têm** `requirePermission` no código, e `units_of_measure:*`/`dashboard:read` **já estão declaradas** em `seed.ts`. O que esta revisão registra é o que ainda faltava de fato: (a) `units_of_measure` e `dashboard` não estavam nos mapas `managerPermissions`/`operatorPermissions`, então MANAGER e OPERATOR tomavam 403 no próprio dashboard; (b) o recurso `storage_positions` (inglês) foi renomeado para `estruturas_armazem:atualizar_posicao` e removido do catálogo. Ver seções 3, 4.1 e 4.5.

---

## 1. Modelo RBAC

Definido em `backend/prisma/schema.prisma`:

```
User ──(N:N via UserRole)── Role ──(N:N via RolePermission)── Permission
```

- **`Permission`** (`permissions`): `resource` + `action` (string livre, sem enum), únicos em conjunto (`@@unique([resource, action])`). Não há hierarquia nem wildcard — cada combinação é um registro independente.
- **`Role`** (`roles`): `code` único (ex.: `ADMIN`), lista de permissões via `RolePermission`.
- **`UserRole`** (`user_roles`): associação N:N entre usuário e perfil (um usuário pode ter mais de um perfil).
- **`RolePermission`** (`role_permissions`): associação N:N entre perfil e permissão.

A verificação (`backend/src/middleware/permission.middleware.ts`, função `requirePermission(resource, action)`) busca o usuário autenticado com todos os seus perfis e permissões e faz uma comparação **exata** de `resource` + `action` contra todas as permissões de todos os perfis do usuário. **Não há bypass para ADMIN nem qualquer lógica de wildcard/hierarquia** — o perfil ADMIN só funciona porque o seed atribui a ele, explicitamente, a totalidade das permissões cadastradas (ver `backend/prisma/seed.ts`, linhas ~190-199).

`requirePermission` é o **único** middleware de autorização granular do backend (confirmado por busca — não há `checkPermission`, `authorize()` ou equivalente). Todas as rotas passam antes por `authMiddleware` (valida JWT), que é condição necessária mas não suficiente: rotas sem `requirePermission` liberam qualquer usuário autenticado, independentemente do seu perfil.

### Estado dos perfis no banco de dev (após o commit `f31a674`)

| Perfil | Permissões atribuídas | Usuários |
|---|---|---|
| `ADMIN` | 112 (100% do catálogo) | 2 |
| `MANAGER` | 86 | 1 |
| `OPERATOR` | 37 | 2 |

(Números conferidos no banco de dev após o seed da revisão 3.)

`seed.ts` agora atribui, além de `ADMIN` (todo o catálogo, como sempre), um conjunto padrão de permissões a `MANAGER` e `OPERATOR` — idempotente, no mesmo padrão `deleteMany`+`createMany` já usado para `ADMIN`. Critério aplicado: `MANAGER` tem leitura/escrita ampla nos módulos de negócio, aprovações de compra e contagem, mas nenhuma ação de exclusão nem gestão de usuários/perfis além de leitura (gerente não é administrador do sistema). `OPERATOR` tem leitura ampla + execução operacional (apontamentos de produção, execução de contagem, recebimento), mas não aprova nem edita cadastro mestre. O ajuste final de estoque por divergência de contagem (`stock:adjustment`, `contagem:aprovar_divergencia`) fica só com `MANAGER` — operador conta e reconta, o ajuste é uma aprovação.

Se o negócio precisar de um perfil diferente do que está descrito acima, ajuste via `POST /roles/:id/permissions` (a atribuição inicial do seed é só um ponto de partida sensato, não uma política imutável) ou edite os mapas `managerPermissions`/`operatorPermissions` em `backend/prisma/seed.ts` e rode o seed de novo.

---

## 2. Recursos e ações realmente aplicados pelas rotas

Esta é a fonte de verdade prática: o que `requirePermission()` de fato impõe, por domínio. Todos os pares abaixo existem na tabela `permissions` do banco consultado.

### Usuários e Segurança

| Método + rota | Permissão exigida |
|---|---|
| `POST /auth/register` | `users:create` |
| `GET /users`, `GET /users/:id` | `users:read` |
| `POST /users` | `users:create` |
| `PUT /users/:id`, `POST /users/:id/roles` | `users:update` |
| `DELETE /users/:id` | `users:delete` |
| `GET /roles`, `GET /roles/:id` | `roles:read` |
| `POST /roles` | `roles:create` |
| `PUT /roles/:id`, `POST /roles/:id/permissions` | `roles:update` |
| `DELETE /roles/:id` | `roles:delete` |
| `GET/POST/DELETE /permissions*` | `roles:read` / `roles:update` (ver nota abaixo) |
| `DELETE /audit-logs/clean` | `audit_logs:delete` |

> **Nota intencional, não é bug:** `permission.routes.ts` reutiliza o escopo `roles:read`/`roles:update` em vez de ter um recurso `permissions` próprio. Há um comentário explícito no código (`backend/src/routes/permission.routes.ts:11-13`) explicando que isso é proposital, "para não travar o próprio administrador fora do sistema", com revisão prevista para uma "Fase 2" do RBAC.
>
> `PUT /users/me/password` não exige permissão de gestão — só autenticação (trocar a própria senha é ação pessoal, coerente).

### Compras (Orçamentos, Pedidos, Recebimentos)

| Recurso | Ações exigidas em alguma rota |
|---|---|
| `orcamentos_compra` | `visualizar`, `criar`, `editar`, `aprovar`, `rejeitar`, `excluir` |
| `pedidos_compra` | `visualizar`, `criar`, `editar`, `aprovar`, `confirmar`, `cancelar`, `excluir` |
| `recebimentos_compra` | `visualizar`, `criar`, `excluir` |

Todas as rotas de `purchase-quotation.routes.ts`, `purchase-order.routes.ts` e `purchase-receipt.routes.ts` são cobertas.

### Armazém (Warehouse / WMS estrutural)

| Recurso | Ações exigidas |
|---|---|
| `armazens` | `visualizar`, `criar`, `editar`, `excluir` |
| `estruturas_armazem` | `visualizar`, `criar`, `editar`, `excluir`, `gerar_posicoes`, `excluir_posicoes`, `atualizar_posicao` |

> `estruturas_armazem:atualizar_posicao` (revisão 3) substitui o antigo `storage_positions:update`. Protege `PUT /storage-positions/position/:positionId` (bloquear/desbloquear, marcar área de picking) e `POST /stock/transfer` (F2.3 — transferência interna entre endereços). Ver 4.1.

**Saldo por posição (`/stock-positions`, F1.1–F1.5 do plano do WMS).** Nenhum recurso novo foi criado — as rotas reaproveitam pares que já existiam e já estão atribuídos a MANAGER e OPERATOR:

| Método + rota | Permissão exigida | Por quê este recurso |
|---|---|---|
| `GET /stock-positions/product/:productId` | `estruturas_armazem:visualizar` | Mesmo recurso que já protege `GET /storage-positions/*`: quem pode ver o endereço pode ver o que tem nele. |
| `GET /stock-positions/position/:positionId` | `estruturas_armazem:visualizar` | idem |
| `GET /stock-positions/occupied` | `estruturas_armazem:visualizar` | idem |
| `GET /stock-positions/divergences` | `stock:read` | Expõe o saldo agregado do produto (compara `stock_position_balances` com `stock_balances`) — é leitura de estoque, não de endereçamento, e os mesmos números já saem em `GET /stock/balances`. |

Todas as quatro estão montadas sob `requireModule('WMS')` em `routes/index.ts`, como o resto do módulo de armazém.

### Contagem de Estoque

| Recurso | Ações exigidas |
|---|---|
| `planos_contagem` | `visualizar`, `criar`, `editar`, `excluir`, `ativar`, `pausar` |
| `sessoes_contagem` | `visualizar`, `criar`, `iniciar`, `completar`, `cancelar` |
| `contagem` | `executar`, `recontar`, `aprovar_divergencia` |
| `relatorios_contagem` | `visualizar` (usado em `GET /counting/sessions/:id/report`) |
| `stock` | `adjustment` (usado em `POST /counting/sessions/:id/adjust-stock`) |

### PCP básico (fechado no commit `f31a674`)

| Recurso | Ações exigidas |
|---|---|
| `products` | `read`, `create`, `update`, `delete` |
| `boms` | `read`, `create`, `update`, `delete` |
| `routings` | `read`, `create`, `update`, `delete` |
| `production_orders` | `read`, `create`, `update`, `delete`, `execute` (`execute` nas rotas `PATCH /:id/status` e `PATCH /:id/progress`, que de fato avançam/concluem a execução; `calculate-materials`/`calculate-operations` usam `update`) |
| `production_pointings` | `read`, `create`, `update`, `delete` |
| `work_centers` | `read`, `create`, `update`, `delete` |
| `suppliers` | `read`, `create`, `update`, `delete` |
| `customers` | `read`, `create`, `update`, `delete` |
| `stock` | `read`, `entry`, `exit`, `adjustment`, `update` (`update` só na rota de reserva, `POST /reserve/:orderId`, sem ação dedicada) |
| `reports` | `production`, `efficiency`, `quality`, `read` (`/work-centers` e `/consolidated` não têm ação dedicada, usam `read`) |
| `mrp` | `read`, `execute`, `consolidate` |

### Cadastros de apoio

| Recurso | Ações exigidas | Onde |
|---|---|---|
| `units_of_measure` | `read`, `create`, `update`, `delete` | `unit-of-measure.routes.ts` (CRUD; `toggle-active` usa `update`) |
| `dashboard` | `read` | `dashboard.routes.ts`, nas 6 rotas de leitura |
| `products` | `read`, `create`, `update`, `delete` | também em `product-category.routes.ts` — categorias reaproveitam o recurso `products`, sem recurso próprio (ver 4.5) |

### Segurança adicional

| Recurso | Ações exigidas |
|---|---|
| `audit_logs` | `read` (nas 4 rotas de leitura), `delete` (limpeza) |

---

## 3. Domínios ainda protegidos só por autenticação (sem `requirePermission`)

Depois do commit `f31a674`, a lista de rotas sem checagem granular ficou bem menor — o que sobra é deliberadamente fora de escopo, não esquecido:

**Revisão 3:** a lista da revisão 2 estava desatualizada — as Fases do WMS fecharam quase toda ela sem que este documento acompanhasse. Estado real conferido no código em 02/09/2026:

| Rota (arquivo) | Situação |
|---|---|
| `dashboard.routes.ts` | ✅ **tem RBAC** — `dashboard:read` nas 6 rotas, e a permissão está declarada em `seed.ts` |
| `unit-of-measure.routes.ts` | ✅ **tem RBAC** — CRUD completo em `units_of_measure`, declarado em `seed.ts` |
| `product-category.routes.ts` | ✅ **tem RBAC** — reaproveita `products:read/create/update/delete` (categoria é sub-cadastro de produto); nenhum recurso `product_categories` foi criado, por opção — ver 4.5 |
| `counting-plan-product.routes.ts` (`/counting/products`) | ✅ **tem RBAC** — `planos_contagem:editar` nas escritas, `planos_contagem:visualizar` na leitura |
| `counting-assignment.routes.ts` (`/counting/assignments`) | ✅ **tem RBAC** — `sessoes_contagem:criar` (atribuir/alterar papel), `:cancelar` (remover atribuição), `:visualizar` (listar). Não existe ação `editar` para `sessoes_contagem` no catálogo; as ações do próprio ciclo de vida da sessão foram reaproveitadas em vez de criar uma nova |
| `pcp-dashboard.routes.ts` | `pcp:dashboard.view` — `seed.ts` documenta como uso client-side (liberar navegação no frontend), não backend; decisão de design, não bug |
| `notification.routes.ts` | **sem RBAC, deliberadamente.** Reconferido rota a rota: as 8 rotas passam por `authMiddleware` e todo controller lê `req.userId` do token, nunca do path/query/body. As escritas (`markAsRead`, `archive`) resolvem a notificação por `findFirst({ where: { id, userId } })` e devolvem 404 se ela for de outro usuário — não há como ler ou alterar notificação alheia mesmo com o id em mãos. `markAllAsRead` e as contagens/métricas filtram por `userId` na query. Nenhuma rota lista ou modifica notificação de terceiros. Adicionar `requirePermission` aqui só criaria um par que todo perfil precisaria ter para usar a própria caixa de notificações — cerimônia sem superfície de acesso indevido para proteger. **Se um dia entrar uma rota administrativa** (listar notificações de outro usuário, disparar notificação para terceiros, painel de entregas), ela precisa de recurso próprio — a ausência de RBAC aqui vale só enquanto todas as rotas forem escopadas ao próprio usuário. |

---

## 4. Inconsistências conhecidas

### 4.1 Nomenclatura divergente entre recurso e caminho da rota — PARCIALMENTE RESOLVIDO na revisão 3
`warehouse.routes.ts` é montado em `/warehouses` mas checa o recurso `armazens` (português); `warehouse-structure.routes.ts` é montado em `/warehouse-structures` mas checa `estruturas_armazem`. Isso **continua assim e é intencional**: o nome do recurso segue o domínio (português, como compras e contagem), não o path da URL.

O que era realmente inconsistente — `storage-position.routes.ts` usando `estruturas_armazem` em cinco rotas e um recurso à parte, `storage_positions:update` (inglês), só na rota `PUT /position/:positionId` — **foi corrigido**: o par virou `estruturas_armazem:atualizar_posicao`.

**Por que sob `estruturas_armazem` e não um recurso novo `posicoes_armazem`:** a EXCLUSÃO de uma posição individual (`DELETE /storage-positions/position/:positionId`) já usava `estruturas_armazem:excluir_posicoes`. Separar a posição em recurso próprio obrigaria a mover também `excluir_posicoes` e `gerar_posicoes` (ambas operam sobre posições, não sobre a estrutura), quebrando duas permissões já atribuídas a MANAGER/OPERATOR em instalações existentes para ganhar uma distinção que ninguém pediu. Ficou tudo sob `estruturas_armazem`, com uma ação específica para o verbo específico — o mesmo padrão que o recurso já usa (`gerar_posicoes`, `excluir_posicoes`).

Alcance da renomeação: entrada em `seed.ts` (a antiga foi **removida do catálogo**, não deixada coexistindo), mapas `managerPermissions`/`operatorPermissions`, `storage-position.routes.ts`, `stock.routes.ts` (`POST /stock/transfer` reusa o mesmo par) e `tests/integration/stock-transfer.routes.test.ts`. O script `backend/scripts/add-storage-position-update-permission.ts`, que recriava o par antigo, foi **deletado** (mesmo motivo dos `add-*-permissions.ts` da 4.3). A remoção do registro órfão em `permissions` é feita pelo próprio `seed.ts`, num bloco "PERMISSÕES OBSOLETAS" que apaga antes as linhas de `role_permissions` que o referenciam — conferido no banco de dev: zero `role_permissions` órfãs após o seed.

### 4.2 ~~`permission.service.ts` tinha uma lista fallback divergente~~ — RESOLVIDO no commit `f31a674`
`PermissionService.seedDefaultPermissions()`, o controller `seedDefault` e a rota `POST /permissions/seed/default` foram **removidos por completo** — mantinham uma segunda fonte de verdade divergente do `seed.ts` real (confirmado sem uso no frontend antes da remoção). A forma correta de adicionar permissão é só a da seção 6 abaixo.

### 4.3 Scripts órfãos em `backend/scripts/` — RESOLVIDO no commit `f31a674`
`add-warehouse-permissions.ts`, `add-warehouse-structure-permissions.ts` e `add-storage-position-permissions.ts` foram **deletados** — inseriam permissões sob nomes de recurso (`warehouses`, `warehouse_structures`, em inglês) que nenhuma rota reconhece; as rotas reais usam `armazens`/`estruturas_armazem` (português). `add-warehouse-permissions-complete.ts` continua existindo — esse **está** alinhado com o código atual, não foi tocado. `add-storage-position-update-permission.ts` foi **deletado na revisão 3**: recriava `storage_positions:update`, que deixou de existir (ver 4.1).

### 4.4 Ações semeadas sem rota — RESOLVIDO no commit `f31a674`
- `pedidos_compra:confirmar`/`cancelar` agora são checadas de fato (antes as rotas reusavam `editar`).
- `pedidos_compra:receber` e `recebimentos_compra:editar` foram **removidas do catálogo** (seed + banco) — nenhuma rota poderia checá-las (recebimento é ato de criar `recebimentos_compra`, não uma sub-ação de `pedidos_compra`; não existe edição de recebimento, só criar/listar/excluir).
- `relatorios_contagem:visualizar` agora é checada em `GET /counting/sessions/:id/report` (antes reusava `sessoes_contagem:visualizar`). `relatorios_contagem:exportar` foi **removida do catálogo** — não existe endpoint de exportação.
- `audit_logs:read` agora é checada nas 4 rotas de leitura de audit log.
- Toda a lista de PCP básico da antiga seção 3 (products, boms, routings, production_orders, production_pointings, work_centers, suppliers, customers, stock, reports, mrp) — agora checada, ver seção 2.

Seguem sem rota, por decisão de design documentada no próprio `seed.ts` (uso client-side, não backend): `modules:view_general/view_pcp/view_wms/view_yms` e `pcp:dashboard.view`.

### 4.5 Permissões sem origem rastreável no repositório — RESOLVIDO
`dashboard:read` e `units_of_measure:create/read/update/delete` já estão declaradas em `seed.ts` (bloco "Fase 2 do cronograma - RBAC estendido") e são verificadas pelas rotas correspondentes. Não há mais permissão em uso sem origem no repo.

**O que ainda faltava e foi corrigido na revisão 3:** as duas estavam declaradas e checadas, mas **fora** dos mapas `managerPermissions`/`operatorPermissions`. Efeito prático: MANAGER e OPERATOR recebiam 403 no dashboard e na lista de unidades de medida — a permissão existia, ninguém além do ADMIN a tinha. Agora `dashboard: ['read']` está nos dois mapas; `units_of_measure` fica com `create/read/update` no MANAGER (sem `delete`, como todos os cadastros) e só `read` no OPERATOR.

**Sobre `product_categories`:** decidido **não criar** o recurso. `product-category.routes.ts` já checa `products:read/create/update/delete`, com comentário explícito no arquivo dizendo que é reaproveitamento consciente (categoria é sub-cadastro de produto). Criar um recurso paralelo agora significaria mais quatro pares no catálogo, mais quatro linhas nos dois mapas de perfil e uma migração de atribuições em instalações existentes — para separar um poder que ninguém pediu para separar: quem pode criar produto pode criar a categoria dele. Se a separação virar requisito de negócio, o caminho é o da seção 6.

---

## 5. Consultas úteis

Consultar permissões efetivas de um usuário:

```sql
SELECT p.resource, p.action, p.description
FROM permissions p
JOIN role_permissions rp ON p.id = rp.permissionId
JOIN user_roles ur ON rp.roleId = ur.roleId
WHERE ur.userId = 'user-id';
```

Contar permissões por perfil:

```sql
SELECT r.code, COUNT(rp.permissionId) AS total
FROM roles r
LEFT JOIN role_permissions rp ON rp.roleId = r.id
GROUP BY r.code;
```

---

## 6. Como adicionar/checar uma permissão corretamente

1. Declare o par `resource`/`action` em `backend/prisma/seed.ts`, seguindo a convenção do domínio (português para módulos de negócio como compras/armazém/contagem, inglês para os módulos herdados como `users`/`products`/`roles`).
2. Aplique `requirePermission('recurso', 'acao')` na rota correspondente, em `backend/src/routes/*.routes.ts`, **depois** de `authMiddleware`.
3. Se `MANAGER` ou `OPERATOR` devem ter essa permissão por padrão, adicione-a também aos mapas `managerPermissions`/`operatorPermissions` em `seed.ts` (bloco "PERMISSÕES PADRÃO DE MANAGER E OPERATOR").
4. Rode o seed (`npx tsx prisma/seed.ts`, a partir de `backend/`) para que a permissão exista de fato na tabela e as atribuições de perfil sejam aplicadas.
5. Não crie scripts avulsos em `backend/scripts/` para isso — o histórico de `add-*-permissions.ts` foi exatamente a causa das inconsistências descritas na seção 4 (a maioria já removida, mas não repita o padrão).
