# Permissões do Sistema Fabric

**Última atualização:** 01/09/2026
**Fonte de verdade usada nesta revisão:** tabela `permissions` consultada ao vivo no MySQL (`fabric-mysql`, banco `fabric`, 112 registros) **cruzada** com todo `requirePermission('recurso', 'ação')` encontrado em `backend/src/routes/*.routes.ts` (99 ocorrências, 48 pares recurso:ação distintos realmente aplicados).

> Este documento substitui integralmente a versão anterior, que afirmava "47 permissões" — número desatualizado desde que os módulos de Compras, Armazém e Contagem de Estoque foram adicionados via scripts avulsos em vez de atualização do `seed.ts`. Os arquivos `PERMISSOES_APROVACAO_COMPRAS.md`, `PERMISSOES_COMPRAS.md`, `PERMISSOES_MODULOS.md` e mais dois documentos redundantes (que divergiam entre si, um citando 47 e outro 74 permissões) foram removidos por serem contraditórios entre si e com o banco real.

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

### Estado dos perfis no banco consultado (2026-09-01)

| Perfil | Permissões atribuídas | Usuários |
|---|---|---|
| `ADMIN` | 112 (100% do catálogo) | 2 |
| `MANAGER` | **0** | 1 |
| `OPERATOR` | **0** | 2 |

Isso é esperado pelo próprio `seed.ts`: ele cria os perfis `MANAGER` e `OPERATOR` sem nenhuma permissão associada (só o `ADMIN` recebe `rolePermission.createMany` com todo o catálogo). A atribuição de permissões a esses dois perfis é manual, via `POST /roles/:id/permissions`, e **nunca foi feita neste ambiente** — na prática, hoje, usuários com perfil `MANAGER` ou `OPERATOR` falham em toda rota que exige `requirePermission`, e só conseguem acessar os endpoints que checam apenas autenticação (seção 3). Vale conferir se isso reflete a intenção real antes de liberar esses perfis em produção.

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
| `pedidos_compra` | `visualizar`, `criar`, `editar`, `aprovar`, `excluir` |
| `recebimentos_compra` | `visualizar`, `criar`, `excluir` |

Todas as rotas de `purchase-quotation.routes.ts`, `purchase-order.routes.ts` e `purchase-receipt.routes.ts` são cobertas.

### Armazém (Warehouse / WMS estrutural)

| Recurso | Ações exigidas |
|---|---|
| `armazens` | `visualizar`, `criar`, `editar`, `excluir` |
| `estruturas_armazem` | `visualizar`, `criar`, `editar`, `excluir`, `gerar_posicoes`, `excluir_posicoes` |
| `storage_positions` | `update` |

### Contagem de Estoque

| Recurso | Ações exigidas |
|---|---|
| `planos_contagem` | `visualizar`, `criar`, `editar`, `excluir`, `ativar`, `pausar` |
| `sessoes_contagem` | `visualizar`, `criar`, `iniciar`, `completar`, `cancelar` |
| `contagem` | `executar`, `recontar`, `aprovar_divergencia` |
| `stock` | `adjustment` (usado em `POST /counting/sessions/:id/adjust-stock` — único uso real do recurso `stock` em toda a base) |

---

## 3. Domínios protegidos só por autenticação (sem `requirePermission`)

Estes arquivos de rota aplicam `authMiddleware` (JWT válido) mas **nenhuma checagem de recurso/ação** — qualquer usuário autenticado, de qualquer perfil, acessa livremente, mesmo que existam permissões correspondentes cadastradas no banco:

| Rota (arquivo) | Permissões existentes no banco para o domínio, mas não checadas |
|---|---|
| `product.routes.ts` | `products:create/read/update/delete` |
| `bom.routes.ts` | `boms:create/read/update/delete` |
| `routing.routes.ts` | `routings:create/read/update/delete` |
| `production-order.routes.ts` | `production_orders:create/read/update/delete/execute` |
| `production-pointing.routes.ts` | `production_pointings:create/read/update/delete` |
| `work-center.routes.ts` | `work_centers:create/read/update/delete` |
| `supplier.routes.ts` | `suppliers:create/read/update/delete` |
| `customer.routes.ts` | `customers:create/read/update/delete` |
| `stock.routes.ts` | `stock:read/update/entry/exit` (só `stock:adjustment`, checado em `counting.routes.ts`, é usado) |
| `reports.routes.ts` | `reports:read/export/production/efficiency/quality` |
| `mrp.routes.ts` | `mrp:read/execute/consolidate` |
| `dashboard.routes.ts` | `dashboard:read` (existe no banco, mas não vem do `seed.ts` nem de nenhum script do repo — origem não rastreável) |
| `pcp-dashboard.routes.ts` | `pcp:dashboard.view` (seed.ts documenta como "usado no frontend", não no backend) |
| `unit-of-measure.routes.ts` | `units_of_measure:create/read/update/delete` (existe no banco, também sem origem rastreável no repo) |
| `product-category.routes.ts` | nenhuma permissão sequer cadastrada para este recurso |
| `notification.routes.ts` | nenhuma permissão cadastrada (razoável — são notificações pessoais do usuário) |
| `counting-plan-product.routes.ts` (montado em `/counting/products`) | nenhuma checagem própria — deveria plausivelmente exigir `planos_contagem:editar` |
| `counting-assignment.routes.ts` (montado em `/counting/assignments`) | nenhuma checagem própria — deveria plausivelmente exigir `sessoes_contagem:editar` ou equivalente |

Isso significa que a superfície de autorização granular real do sistema é bem menor do que o catálogo de 112 permissões sugere: **compras, armazém, contagem (planos/sessões/itens), usuários, perfis e exclusão de audit logs** são os únicos domínios de fato protegidos por permissão específica. Todo o restante do PCP básico (produtos, BOMs, roteiros, ordens e apontamentos de produção, centros de trabalho, fornecedores, clientes, estoque, relatórios, MRP) está aberto a qualquer usuário autenticado.

---

## 4. Inconsistências conhecidas

### 4.1 Nomenclatura divergente entre recurso e caminho da rota
`warehouse.routes.ts` é montado em `/warehouses` mas checa o recurso `armazens` (português); `warehouse-structure.routes.ts` é montado em `/warehouse-structures` mas checa `estruturas_armazem`. Já `storage-position.routes.ts` mistura os dois: a maioria das ações usa `estruturas_armazem` (`visualizar`, `excluir_posicoes`, `gerar_posicoes`), mas a rota `PUT /position/:positionId` usa um recurso à parte, `storage_positions:update` — três nomenclaturas diferentes (`armazens`, `estruturas_armazem`, `storage_positions`) para o mesmo módulo funcional.

### 4.2 `permission.service.ts` tem uma lista fallback divergente, mas de baixo risco — hoje
`PermissionService.seedDefaultPermissions()` (`backend/src/services/permission.service.ts:82-155`) mantém uma lista própria, menor e com nomenclatura diferente da usada por `seed.ts` e pelas rotas: usa `counting:create/read/update/delete/execute` (as rotas reais usam `planos_contagem`, `sessoes_contagem` e `contagem` com ações em português), `pcp.dashboard:view` (o seed real usa `pcp:dashboard.view` — resource e ação trocados) e `counting.plans:print` (o seed real usa `counting:plans.print`).

Essa lista **não roda automaticamente** — só é executada manualmente via `POST /permissions/seed/default` (protegida por `roles:update`), e usa `findFirst`+`create` (não sobrescreve nada existente). Como o banco consultado **não contém** nenhuma das entradas dessa lista (confirmado: não há `counting:create`, `counting:read` etc. na tabela), o endpoint nunca foi de fato acionado neste ambiente. Ainda assim, é um risco latente: se algum administrador chamar esse endpoint, ele vai **poluir a tabela `permissions`** com ~8 pares recurso:ação que nenhuma rota jamais checa, por divergirem da nomenclatura real.

### 4.3 Scripts avulsos em `backend/scripts/` com nomenclatura que nenhuma rota reconhece
Vários scripts de `backend/scripts/add-*.ts` inserem permissões com nomes que **não correspondem** ao que as rotas atuais checam — e, pela consulta ao banco, não foram aplicados neste ambiente (não aparecem nos 112 registros):

- `add-warehouse-permissions.ts` insere `warehouses:view/create/update/delete` (inglês) — as rotas usam `armazens:visualizar/criar/editar/excluir` (português). `add-warehouse-permissions-complete.ts`, por outro lado, insere exatamente `armazens:*` e `estruturas_armazem:*` — **esse é o script alinhado com o código atual**; o outro é órfão/obsoleto.
- `add-warehouse-structure-permissions.ts` insere `warehouse_structures:view/create/update/delete` — as rotas usam `estruturas_armazem`, não `warehouse_structures`. Órfão.
- `add-storage-position-permissions.ts` também insere sob `warehouse_structures` (incluindo `gerar_posicoes`/`excluir_posicoes`) — mesmo problema.
- `add-storage-position-update-permission.ts` insere `storage_positions:update` — este **está** alinhado com a rota real (`PUT /storage-positions/position/:positionId`).

Recomendação prática: se algum desses scripts for executado num ambiente novo (staging, produção), `add-warehouse-permissions.ts`, `add-warehouse-structure-permissions.ts` e `add-storage-position-permissions.ts` devem ser evitados/removidos — eles não semeiam nada que as rotas reconheçam.

### 4.4 Ações semeadas que nenhuma rota verifica (permissões "mortas")
Confirmado por comparação direta entre o catálogo (112 registros) e os 48 pares realmente checados:

- `pedidos_compra:confirmar`, `pedidos_compra:cancelar`, `pedidos_compra:receber` — existem no banco (seed.ts as declara explicitamente), mas as rotas equivalentes (`PATCH /purchase-orders/:id/confirm` e `.../cancel`) checam `pedidos_compra:editar`, não as ações específicas. `receber` não é checado em lugar nenhum.
- `recebimentos_compra:editar` — semeada, mas não existe rota `PUT`/`PATCH` de edição de recebimento (só criar, listar, excluir).
- `relatorios_contagem:visualizar` e `relatorios_contagem:exportar` — semeadas, mas o endpoint de relatório de sessão (`GET /counting/sessions/:id/report`) checa `sessoes_contagem:visualizar` em vez de usar este recurso dedicado.
- `modules:view_general/view_pcp/view_wms/view_yms` e `pcp:dashboard.view` — não são checadas por nenhuma rota backend; o próprio `seed.ts` as documenta como "usado pelo frontend para liberar navegação", ou seja, uso client-side apenas. Isso é uma decisão de design, não um bug, mas vale registrar para quem for auditar.
- `audit_logs:read` — semeada, mas as rotas de listagem/detalhe de audit log (`GET /audit-logs`, `/:id`, `/statistics`, `/resource/:resource/:resourceId`) não checam permissão nenhuma, só autenticação; só `DELETE /audit-logs/clean` usa `audit_logs:delete`.
- Toda a lista da seção 3 (products, boms, routings, production_orders, production_pointings, work_centers, suppliers, customers, stock exceto adjustment, reports, mrp) — permissões semeadas, nenhuma rota as verifica.

### 4.5 Permissões sem origem rastreável no repositório
`dashboard:read` e `units_of_measure:create/read/update/delete` existem no banco consultado, mas não aparecem em `seed.ts` nem em nenhum script de `backend/scripts/`. Provavelmente foram criadas manualmente via `POST /permissions` (a API de gestão de permissões permite criação avulsa, protegida por `roles:update`). Nenhuma rota as verifica.

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

Ao adicionar uma permissão nova, siga o padrão real observado no código (não o do `permission.service.ts`, que está desalinhado — ver 4.2):

1. Declare o par `resource`/`action` em `backend/prisma/seed.ts`, seguindo a convenção do domínio (português para módulos de negócio como compras/armazém/contagem, inglês para os módulos herdados como `users`/`products`/`roles`).
2. Aplique `requirePermission('recurso', 'acao')` na rota correspondente, em `backend/src/routes/*.routes.ts`, **depois** de `authMiddleware`.
3. Rode o seed (`npx prisma db seed` ou equivalente) para que a permissão exista de fato na tabela.
4. Não crie scripts avulsos em `backend/scripts/` para isso — o histórico de `add-*-permissions.ts` é exatamente a causa das inconsistências descritas na seção 4.
