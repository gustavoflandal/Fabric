# Permissões do Sistema Fabric

**Última atualização:** 01/09/2026 (revisão 2 — reflete o fechamento do RBAC do PCP)
**Fonte de verdade usada na revisão original:** tabela `permissions` consultada ao vivo no MySQL (`fabric-mysql`, banco `fabric`) **cruzada** com todo `requirePermission('recurso', 'ação')` encontrado em `backend/src/routes/*.routes.ts`.

> Este documento substitui integralmente a versão anterior a esta faxina, que afirmava "47 permissões" — número desatualizado desde que os módulos de Compras, Armazém e Contagem de Estoque foram adicionados via scripts avulsos em vez de atualização do `seed.ts`. Os arquivos `PERMISSOES_APROVACAO_COMPRAS.md`, `PERMISSOES_COMPRAS.md`, `PERMISSOES_MODULOS.md` e mais dois documentos redundantes (que divergiam entre si, um citando 47 e outro 74 permissões) foram removidos por serem contraditórios entre si e com o banco real.

> **Revisão 2:** a revisão original desta faxina (mesmo dia) documentou um gap real de autorização — a maior parte do PCP básico não tinha checagem granular de permissão, e `MANAGER`/`OPERATOR` estavam com zero permissões atribuídas. Isso foi corrigido no commit `f31a674` (branch `fix-rbac-pcp-manager-operator`, ainda não mesclada em `main` no momento desta edição). Esta revisão atualiza o documento para descrever o estado **já corrigido**. Se você está lendo isto e a branch de correção ainda não foi mesclada, confira `git log` antes de confiar cegamente nas seções 2 e 3 abaixo.

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
| `ADMIN` | 109 (100% do catálogo) | 2 |
| `MANAGER` | 79 | 1 |
| `OPERATOR` | 33 | 2 |

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
| `estruturas_armazem` | `visualizar`, `criar`, `editar`, `excluir`, `gerar_posicoes`, `excluir_posicoes` |
| `storage_positions` | `update` |

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

### Segurança adicional

| Recurso | Ações exigidas |
|---|---|
| `audit_logs` | `read` (nas 4 rotas de leitura), `delete` (limpeza) |

---

## 3. Domínios ainda protegidos só por autenticação (sem `requirePermission`)

Depois do commit `f31a674`, a lista de rotas sem checagem granular ficou bem menor — o que sobra é deliberadamente fora de escopo, não esquecido:

| Rota (arquivo) | Situação |
|---|---|
| `dashboard.routes.ts` | `dashboard:read` existe no banco, mas sem origem rastreável no repo (provavelmente criada manualmente via `POST /permissions`) — fora do escopo aprovado para esta correção |
| `pcp-dashboard.routes.ts` | `pcp:dashboard.view` — `seed.ts` documenta como uso client-side (liberar navegação no frontend), não backend; decisão de design, não bug |
| `unit-of-measure.routes.ts` | `units_of_measure:create/read/update/delete` existe no banco, sem origem rastreável no repo — fora do escopo aprovado |
| `product-category.routes.ts` | nenhuma permissão cadastrada para este recurso |
| `notification.routes.ts` | nenhuma permissão cadastrada (razoável — são notificações pessoais do usuário) |
| `counting-plan-product.routes.ts` (montado em `/counting/products`) | nenhuma checagem própria — deveria plausivelmente exigir `planos_contagem:editar`; fora do escopo aprovado desta rodada |
| `counting-assignment.routes.ts` (montado em `/counting/assignments`) | nenhuma checagem própria — deveria plausivelmente exigir `sessoes_contagem:editar` ou equivalente; fora do escopo aprovado desta rodada |

Os últimos quatro (`product-category`, `notification`, `counting-plan-product`, `counting-assignment`) mais `dashboard`/`unit-of-measure` são candidatos naturais para uma próxima rodada, se fizer sentido.

---

## 4. Inconsistências conhecidas

### 4.1 Nomenclatura divergente entre recurso e caminho da rota
`warehouse.routes.ts` é montado em `/warehouses` mas checa o recurso `armazens` (português); `warehouse-structure.routes.ts` é montado em `/warehouse-structures` mas checa `estruturas_armazem`. Já `storage-position.routes.ts` mistura os dois: a maioria das ações usa `estruturas_armazem` (`visualizar`, `excluir_posicoes`, `gerar_posicoes`), mas a rota `PUT /position/:positionId` usa um recurso à parte, `storage_positions:update` — três nomenclaturas diferentes (`armazens`, `estruturas_armazem`, `storage_positions`) para o mesmo módulo funcional.

### 4.2 ~~`permission.service.ts` tinha uma lista fallback divergente~~ — RESOLVIDO no commit `f31a674`
`PermissionService.seedDefaultPermissions()`, o controller `seedDefault` e a rota `POST /permissions/seed/default` foram **removidos por completo** — mantinham uma segunda fonte de verdade divergente do `seed.ts` real (confirmado sem uso no frontend antes da remoção). A forma correta de adicionar permissão é só a da seção 6 abaixo.

### 4.3 Scripts órfãos em `backend/scripts/` — RESOLVIDO no commit `f31a674`
`add-warehouse-permissions.ts`, `add-warehouse-structure-permissions.ts` e `add-storage-position-permissions.ts` foram **deletados** — inseriam permissões sob nomes de recurso (`warehouses`, `warehouse_structures`, em inglês) que nenhuma rota reconhece; as rotas reais usam `armazens`/`estruturas_armazem` (português). `add-warehouse-permissions-complete.ts` e `add-storage-position-update-permission.ts` continuam existindo — esses **estão** alinhados com o código atual, não foram tocados.

### 4.4 Ações semeadas sem rota — RESOLVIDO no commit `f31a674`
- `pedidos_compra:confirmar`/`cancelar` agora são checadas de fato (antes as rotas reusavam `editar`).
- `pedidos_compra:receber` e `recebimentos_compra:editar` foram **removidas do catálogo** (seed + banco) — nenhuma rota poderia checá-las (recebimento é ato de criar `recebimentos_compra`, não uma sub-ação de `pedidos_compra`; não existe edição de recebimento, só criar/listar/excluir).
- `relatorios_contagem:visualizar` agora é checada em `GET /counting/sessions/:id/report` (antes reusava `sessoes_contagem:visualizar`). `relatorios_contagem:exportar` foi **removida do catálogo** — não existe endpoint de exportação.
- `audit_logs:read` agora é checada nas 4 rotas de leitura de audit log.
- Toda a lista de PCP básico da antiga seção 3 (products, boms, routings, production_orders, production_pointings, work_centers, suppliers, customers, stock, reports, mrp) — agora checada, ver seção 2.

Seguem sem rota, por decisão de design documentada no próprio `seed.ts` (uso client-side, não backend): `modules:view_general/view_pcp/view_wms/view_yms` e `pcp:dashboard.view`.

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

1. Declare o par `resource`/`action` em `backend/prisma/seed.ts`, seguindo a convenção do domínio (português para módulos de negócio como compras/armazém/contagem, inglês para os módulos herdados como `users`/`products`/`roles`).
2. Aplique `requirePermission('recurso', 'acao')` na rota correspondente, em `backend/src/routes/*.routes.ts`, **depois** de `authMiddleware`.
3. Se `MANAGER` ou `OPERATOR` devem ter essa permissão por padrão, adicione-a também aos mapas `managerPermissions`/`operatorPermissions` em `seed.ts` (bloco "PERMISSÕES PADRÃO DE MANAGER E OPERATOR").
4. Rode o seed (`npx tsx prisma/seed.ts`, a partir de `backend/`) para que a permissão exista de fato na tabela e as atribuições de perfil sejam aplicadas.
5. Não crie scripts avulsos em `backend/scripts/` para isso — o histórico de `add-*-permissions.ts` foi exatamente a causa das inconsistências descritas na seção 4 (a maioria já removida, mas não repita o padrão).
