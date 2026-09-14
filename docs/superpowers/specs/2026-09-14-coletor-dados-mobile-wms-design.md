# Coletor de Dados / Mobile — Operações de WMS

**Data:** 2026-09-14
**Status:** design aprovado, aguardando plano de implementação
**Etapa:** primeira entrega do módulo — app mobile (PWA) para separação, recebimento/endereçamento, transferências e contagem, com leitura de código de barras/QR Code (coletor físico + câmera), fila offline de curta duração, captura de fotos e um mecanismo de ocorrências (avaria, divergência de contagem) com notificação e bloqueio condicional configurável. Fora de escopo desta entrega: qualquer área fora do WMS (ex. Manutenção em campo), app nativo, offline de longa duração (cache completo de dados), motor genérico de regras de ocorrência.

## Contexto e motivação

O usuário pediu dois módulos novos (coletor de dados/mobile para o WMS e integração de API para ERP) — tratados como dois specs independentes por serem subsistemas sem sobreposição real de design (um é frontend mobile-first consumindo APIs majoritariamente já existentes; o outro é uma camada de backend nova com modelo de segurança de sistema-a-sistema). Este spec cobre só o primeiro.

Levantamento do estado atual, antes de desenhar:

- **Já existe e pode ser reaproveitado**: `POST /warehouse-tasks/:id/scan` (valida um código lido contra o que a tarefa espera — posição ou produto), `GET /warehouse-tasks/my` (fila de tarefas do operador logado, já usada por `PickingView.vue`/`OperationsPanelView.vue` no desktop), `POST /stock/transfer` (transferência avulsa), os endpoints de `CountingSession`/`CountingItem` (contagem, já com uma tela "mobile-first" de referência em `CountingSessionExecute.vue`), e o sistema de Notificações (`Notification`/`NotificationRule`, roteamento de evento→papel já pronto) e Configurações do Sistema (`SystemSetting`, com precedente de chave de limiar configurável em `wms.task_delay_threshold_hours`).
- **Não existe e precisa ser construído**: nenhum frontend chama `/scan` hoje — o único código de leitura de código de barras do projeto (`frontend/src/hooks/useBarcodeScanner.ts`) é código morto em React dentro de um projeto Vue, nunca funcionou. Não há infraestrutura de PWA (manifest/service worker). Não há infraestrutura de upload/armazenamento de arquivo em lugar nenhum do backend (nem a leitura de NFe usa upload — trabalha com o XML como texto).

## Abordagens consideradas

**Onde o app mobile vive:**

- **A — Novas rotas `/mobile/*` dentro do projeto Vue atual, com PWA (escolhida).** Mesmo build/deploy, mesma autenticação/RBAC/interceptors já existentes, layout próprio (`MobileLayout.vue`) sem o chrome de desktop. Vue Router já faz lazy-load por rota, então o bundle do desktop não cresce.
- **B — Projeto PWA separado (outro Vite app).** Rejeitada: duplicaria autenticação/refresh-token/tipos compartilhados sem tooling de monorepo no projeto — manutenção dobrada sem ganho prático pro tamanho deste app.
- **C — Adicionar leitura de scanner nas telas de desktop existentes.** Rejeitada: essas telas têm filtros/tabelas/ações administrativas que não cabem numa tela de celular, e não entregam a fila "o que eu faço agora" que um operador de chão precisa.

**Modelo de fila de tarefas:**

- **A — Fila única e plana, todos os tipos de `WarehouseTask` juntos (escolhida).** Ao contrário do desktop, que separa `OperationsPanelView` (agrupado por recebimento) de `PickingView` (filtrado só por Picking), o mobile unifica tudo: o operador de chão pensa em "próxima tarefa", não em "qual tela". Mesmo espírito da fila que `PickingView` já usa, sem o filtro de tipo.
- **B — Uma tela por tipo de tarefa, espelhando o desktop.** Rejeitada: multiplica telas sem necessidade — o componente de detalhe+scan é o mesmo pra qualquer tipo, só muda o rótulo.

**Regras de ocorrência (avaria, divergência de contagem):**

- **A — Conjunto fixo de tipos, configurados em Configurações do Sistema (escolhida).** Mesmo padrão já existente (`wms.task_delay_threshold_hours` é o precedente direto de uma chave de limiar). Rápido de construir, cobre o caso real descrito pelo usuário.
- **B — Motor genérico de regras (admin cadastra tipo/condição pela tela).** Rejeitada nesta entrega: equivalente em esforço ao construtor de condições do workflow dinâmico que já existe no WMS — um projeto por si só. Fica como extensão futura natural se o conjunto fixo se mostrar insuficiente; o model `WmsOccurrence` abaixo não precisa mudar pra isso, só a origem da configuração.

**Armazenamento de fotos:**

- **A — Disco local via volume Docker (escolhida).** Endpoint de upload salva o arquivo, grava o caminho no banco, serve via rota estática. Sem serviço novo no docker-compose — adequado a uma instância única self-hosted, que é como o projeto roda hoje.
- **B — Object storage compatível com S3 (MinIO).** Rejeitada nesta entrega: mais robusto pra multi-instância/backup, mas adiciona um serviço inteiro de infraestrutura sem necessidade comprovada ainda.

**Tolerância a rede:**

- **A — Fila local de ações pendentes (IndexedDB), sem cache de dados (escolhida).** Cobre "zonas mortas" momentâneas (segundos a poucos minutos): ações de mutação (scan/execute/transfer/contagem/ocorrência) que falham por rede ficam guardadas e são reenviadas automaticamente quando a conexão volta. Não duplica os DADOS (lista de tarefas, saldos) localmente.
- **B — Offline-first completo (cache de leitura + fila de escrita).** Rejeitada nesta entrega: o usuário confirmou que as quedas são curtas e só de passagem, não períodos longos trabalhando sem sinal — um cache completo com resolução de conflito é uma arquitetura bem mais pesada sem necessidade comprovada.

## Desenho

### 1. Schema Prisma (2 models novos)

```prisma
enum WmsOccurrenceType {
  AVARIA
  DIVERGENCIA_CONTAGEM
  OUTRO
}

enum WmsOccurrenceStatus {
  ABERTA
  LIBERADA
}

// Referência polimórfica, mesmo padrão de WarehouseTask.reference/StockMovement.reference —
// aponta pra uma WarehouseTask ou um CountingItem, sem FK direta pros dois.
model WmsOccurrence {
  id            String              @id @default(uuid())
  type          WmsOccurrenceType
  referenceType String              // 'WAREHOUSE_TASK' | 'COUNTING_ITEM'
  reference     String              // id da tarefa/item
  description   String              @db.Text
  status        WmsOccurrenceStatus @default(ABERTA)
  blocking      Boolean             @default(false) // decidido no momento da criação, a partir da config vigente — não recalcula se a config mudar depois

  reportedBy String
  reportedAt DateTime @default(now())

  releasedBy   String?
  releasedAt   DateTime?
  releaseNote  String?  @db.Text

  photos   WmsOccurrencePhoto[]
  reporter User                 @relation("OccurrenceReporter", fields: [reportedBy], references: [id])
  releaser User?                @relation("OccurrenceReleaser", fields: [releasedBy], references: [id])

  @@index([referenceType, reference])
  @@index([status])
  @@map("wms_occurrences")
}

model WmsOccurrencePhoto {
  id           String   @id @default(uuid())
  occurrenceId String
  filePath     String   // caminho relativo no volume local, nunca absoluto
  createdAt    DateTime @default(now())

  occurrence WmsOccurrence @relation(fields: [occurrenceId], references: [id], onDelete: Cascade)

  @@map("wms_occurrence_photos")
}
```

`blocking` é decidido e congelado na criação (lendo a `SystemSetting` do tipo correspondente naquele instante) — se o admin mudar a configuração depois, ocorrências já abertas não mudam de comportamento retroativamente. Consistente com o resto do sistema, que sempre resolve configuração no momento da ação, não de forma reativa.

### 2. Dois gatilhos bem diferentes, não um só

Ambiguidade pega na autorrevisão deste spec: o pedido original descreve avaria como algo que o OPERADOR reporta, e divergência de contagem como algo que o SISTEMA detecta sozinho a partir de números — não a mesma ação em dois disfarces.

- **`AVARIA` e `OUTRO` — manual.** No detalhe da tarefa (mobile), botão "Reportar Ocorrência" (sempre disponível, nunca obrigatório, não trava o fluxo normal por si só) → tira foto(s) + descrição → `POST /wms-occurrences`.
- **`DIVERGENCIA_CONTAGEM` — automático, sem botão e sem foto.** Toda vez que o registro de um item de contagem (`/mobile/counting`) grava uma quantidade diferente da esperada pelo sistema, o backend conta quantas divergências já aconteceram PARA AQUELE PRODUTO NAQUELA SESSÃO; ao atingir `wms.occurrence.divergencia_contagem.threshold`, o próprio serviço de contagem cria a `WmsOccurrence` internamente (`reportedBy` = o operador que registrou a contagem que cruzou o limiar — é quem gerou o evento, não quem "denunciou" nada). Não passa pelo endpoint público `POST /wms-occurrences` (esse é só pra criação manual vinda do mobile).

Em ambos os casos, `WarehouseTask` e `CountingItem` ganham um campo derivado (não persistido — calculado via `EXISTS` contra `WmsOccurrence` aberta e bloqueante para aquela referência) usado como guarda em `execute()`/no registro de contagem: se houver uma `WmsOccurrence` com `status: ABERTA` e `blocking: true` para aquela tarefa/item, a ação é recusada com 400 e a mensagem aponta a ocorrência. Mesmo padrão de guarda condicional já usado pelo módulo de Expedição (bloqueio de cancelamento por tarefa `COMPLETED`).

### 3. Configurações do Sistema (3 chaves novas, categoria `wms`)

| Chave | Tipo | Valores/uso |
|---|---|---|
| `wms.occurrence.avaria.action` | enum fechado | `NOTIFY` \| `BLOCK` |
| `wms.occurrence.divergencia_contagem.threshold` | número | quantas divergências do MESMO produto na MESMA sessão de contagem disparam a regra |
| `wms.occurrence.divergencia_contagem.action` | enum fechado | `NOTIFY` \| `BLOCK` |

`OUTRO` sempre só notifica (não bloqueia) — é a categoria "genérica", sem limiar.

### 4. Backend — endpoints novos

- `POST /wms-occurrences` — cria uma ocorrência **manual** (`AVARIA`/`OUTRO`; multipart, aceita 0-N fotos), decide `blocking` pela config vigente, dispara notificação (`eventType: 'wms.occurrence.reported'`, reaproveitando `NotificationRule` já existente). `DIVERGENCIA_CONTAGEM` não passa por aqui — nasce dentro do serviço de contagem, mas dispara a mesma notificação e respeita o mesmo guard de bloqueio.
- `GET /wms-occurrences?status=ABERTA` — lista para a tela de liberação (RBAC `ocorrencias:visualizar`).
- `POST /wms-occurrences/:id/release` — libera (RBAC `ocorrencias:liberar`, seed: MANAGER + ADMIN).
- `GET /wms-occurrences/photos/:photoId` — serve o arquivo (autenticado, não é uma rota estática pública).
- `POST /warehouse-tasks/:id/scan` e o restante dos endpoints de tarefa/contagem/transferência: **sem mudança de contrato**, só passam a ser consumidos por um novo cliente.

### 5. Frontend — rotas e componentes

Rotas (`/mobile/*`, guarda de rota reaproveitando o RBAC existente):

- `/mobile` — Início: 3 botões grandes (Minhas Tarefas · Mover Agora · Contagem) com contador de pendências.
- `/mobile/tasks` — fila única de `WarehouseTask` (`GET /warehouse-tasks/my`), qualquer tipo.
- `/mobile/tasks/:id` — detalhe + leitura; se bloqueada por ocorrência, mostra "Aguardando liberação" em vez do fluxo normal.
- `/mobile/transfer` — ação livre de transferência (`POST /stock/transfer`).
- `/mobile/counting` — sessões/itens de contagem atribuídos ao operador.

Componentes/composables compartilhados:

- `MobileLayout.vue` — chrome mínimo.
- `ScanInput.vue` — aceita coletor físico (input sempre focado, captura Enter do keyboard-wedge) e câmera (`@zxing/browser`, cobre 1D — EAN/Code128 — e QR Code no mesmo leitor); fallback automático pra modo físico se a câmera não tiver permissão.
- `PhotoCapture.vue` — `<input type="file" capture="environment">`, usado no fluxo de "Reportar Ocorrência".
- `useOfflineQueue.ts` — envolve toda chamada de mutação (scan/execute/transfer/contagem/ocorrência); falha de rede enfileira no IndexedDB (ação avança otimisticamente com selo "sincronizando…"), falha de validação real não enfileira (é erro imediato); drena a fila em ordem (FIFO, retry exponencial) quando a conexão volta.

Tela desktop nova:

- `/occurrences` — lista de ocorrências abertas (foto, descrição, quem reportou), botão "Liberar" com nota opcional. RBAC `ocorrencias:visualizar`/`ocorrencias:liberar`.

### 6. PWA

`vite-plugin-pwa` (ou manifest+service worker manuais), manifest escopado — ícone próprio, tela cheia, instalável a partir do Chrome em Android (cobre tanto celular comum quanto coletores Zebra/Honeywell, que rodam Android+Chrome). Service worker cobre só o necessário pra fila offline funcionar (não faz cache de app-shell agressivo que arrisque servir tela desatualizada).

## Tratamento de erro

- Código lido não bate com o esperado → feedback visual grande (vermelho) + vibração se suportado; não envia `execute`.
- Câmera sem permissão/indisponível → cai pro modo coletor físico automaticamente, com aviso.
- Tarefa/item bloqueado por ocorrência aberta → tela dedicada de "Aguardando liberação", sem tentar o fluxo normal.
- Item da fila offline que falha por validação real ao sincronizar (não por rede) → marcado "falhou", não fica retentando indefinidamente, notifica o operador pra revisar manualmente.

## Testes

- Backend: suíte de integração nova para `wms-occurrence.service.ts` (criação, threshold de divergência, bloqueio/liberação, RBAC de liberação, congelamento de `blocking` no momento da criação), rodando contra o MySQL de teste real como o resto do projeto.
- Frontend: `ScanInput.vue` nos dois modos de entrada (Enter simulado; lib de câmera mockada); `useOfflineQueue` com mock de IndexedDB e `navigator.onLine`; specs das 5 telas mobile no mesmo padrão já usado no resto do projeto (service mockado, dado real, estados vazio/erro).
- Verificação manual: sem coletor físico disponível nesta sessão — verificação via Chrome DevTools (emulação mobile + throttling de rede), reportada como tal, não como teste em dispositivo real. Teste em coletor/celular real fica a cargo do usuário antes de considerar o módulo pronto para uso em produção.

## Fora de escopo desta entrega

- Qualquer área fora do WMS (ex. Manutenção em campo) — cogitado e descartado pelo usuário para esta rodada; o app nasce com uma tela inicial que comporta novos módulos depois, sem redesenho.
- App nativo (React Native/Capacitor) — PWA cobre a necessidade descrita.
- Offline de longa duração (cache completo de dados, resolução de conflito) — só fila de ações pendentes por curtas quedas de sinal.
- Motor genérico de regras de ocorrência (admin cria tipos/condições pela tela) — conjunto fixo de 3 tipos cobre o caso descrito; extensão futura não exige mudar o model.
- Ligação automática entre uma `WmsOccurrence` de avaria e um ajuste de estoque — a liberação é só o gate de aprovação; qualquer ajuste físico de saldo continua pelos fluxos já existentes (ajuste de estoque manual).
