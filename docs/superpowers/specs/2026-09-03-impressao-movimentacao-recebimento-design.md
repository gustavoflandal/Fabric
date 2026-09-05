# Impressão de comprovantes de movimentação + tela de Recebimento (com NFe)

**Data:** 2026-09-03
**Status:** design aprovado, aguardando plano de implementação
**Etapa:** 1 de 2 (a segunda etapa — tela de tarefas do WMS orientada a coletor, F4.12, com modo papel — é um projeto separado, fora deste spec)

## Contexto e motivação

O usuário (dono do produto) pediu para preparar o sistema para impressão em papel de tudo que envolver movimentação de estoque, principalmente no WMS, porque muitos clientes não usam coletor de dados (leitor de código de barras).

Levantamento do estado atual (feito antes de desenhar):

- **Estoque (`StockView.vue`)** já registra Entrada/Saída/Ajuste, mas não imprime nada.
- **Compras** (Pedidos e Cotações) e **Inventário** (planos de contagem) já imprimem PDF hoje, via `frontend/src/utils/pdf-generator.ts` (Compras) e via jsPDF direto no próprio componente (Inventário — inconsistência pré-existente, fora de escopo deste spec).
- **Recebimento simples** (sem WMS licenciado) — o backend (`purchase-receipt.routes.ts`/`.service.ts`) funciona ponta a ponta, testado, mas **não existe nenhuma tela no frontend**. Hoje é inacessível para um usuário do sistema.
- **Fase 4 do WMS** (recebimento e separação orientados a tarefa, pensada para coletor/smartphone — `WarehouseTask`, putaway, picking, reposição) está implementada **só no backend**. Não tem tela nem desktop nem mobile. O próprio documento de arquitetura (`docs/fase-2026-09-modernizacao/WMS_IMPLEMENTATION_ANALYSIS.md`, seção 7) registra que o frontend dessa fase foi **deliberadamente deixado de fora** como decisão de produto separada.

Decisão de escopo (confirmada com o usuário): este spec cobre **só a etapa 1** — as telas que já existem hoje (Estoque) e a tela de Recebimento simples, que nunca teve UI. A tela de tarefas do WMS orientada a coletor (etapa 2) fica para um projeto futuro, com seu próprio spec.

## Abordagens consideradas

**A — Reaproveitar `pdf-generator.ts` (escolhida).** Generalizar o utilitário de PDF já usado por Compras, adicionar botões "Imprimir" nas telas novas/existentes. Menor risco, consistente com o padrão já estabelecido no código.

**B — Impressão nativa do navegador (`window.print()` + CSS `@media print`).** Rejeitada: nenhum precedente no projeto (confirmado por busca — zero ocorrências), mais trabalho de estilização entre navegadores, não gera um arquivo persistente/anexável como o PDF gera.

**C — Comprovante com QR/código de barras embutido, pensando em reconciliação futura com coletor.** Rejeitada por YAGNI: o pedido é justamente para quem NÃO tem coletor; não há nada hoje que leria esse código de volta.

## Desenho

### 1. Utilitário de PDF compartilhado (`frontend/src/utils/pdf-generator.ts`)

Generalizar a opção de assinatura, hoje fixa:

```ts
// Antes
interface PdfOptions {
  ...
  supplierSignature?: boolean; // sempre rotula "Assinatura do Fornecedor"
}

// Depois
interface PdfOptions {
  ...
  signature?: { label: string }; // rótulo customizável
}
```

Atualizar os 2 call sites existentes (`PurchaseOrdersView.vue`, `PurchaseQuotationsView.vue`) de `supplierSignature: true` para `signature: { label: 'Assinatura do Fornecedor' }` — mesmo resultado visual, só a API do utilitário muda. Sem mudança de comportamento para quem já usa.

### 2. StockView — impressão de comprovantes de movimentação

- Após um registro bem-sucedido de Entrada/Saída/Ajuste, o fechamento do modal passa a oferecer um botão **"Imprimir Comprovante"** (manual — não abre sozinho, conforme decidido).
- Cada linha do histórico de movimentações (modal "Ver Movimentações", já existe e usa `DataTable`) ganha uma ação **"Imprimir"** para reimpressão a qualquer momento, usando os dados já carregados daquela movimentação.
- Conteúdo do comprovante (via `generatePDF`): título "Comprovante de Movimentação de Estoque", dados (Tipo, Produto, Quantidade, Motivo, Referência, Data, Usuário), `signature: { label: 'Assinatura de Quem Executou' }`.

### 3. Nova tela "Recebimento" (não existe hoje)

**Arquivos** (seguindo a convenção já usada por Compras): `frontend/src/views/purchases/PurchaseReceiptsView.vue` (lista) e `PurchaseReceiptFormView.vue` (novo recebimento).
**Rotas:** `/purchases/receipts` (lista) e `/purchases/receipts/new` (novo).
**Navegação:** card no Dashboard, aba **WMS** (ao lado de Inventário/Armazéns/Estruturas de Armazém) — confirmado com o usuário, mesmo o recurso de backend vivendo sob nomenclatura de compras.
**Permissão:** reaproveita `recebimentos_compra` (já seedada, já atribuída a MANAGER/OPERATOR — ver `purchase-receipt.routes.ts`). *Observação à parte, não bloqueante:* `PermissionsModal.vue` já tem um rótulo `warehouse_receipts: 'Recebimento de Mercadorias'` para um recurso que não existe no backend (o recurso real é `recebimentos_compra`, com outro rótulo próprio) — provável divergência antiga, vale uma limpeza separada, fora deste spec.

**Tela de lista** (`DataTable`, padrão do resto do sistema): recebimentos já feitos (`GET /purchase-receipts`) — Número, Pedido, Data, Recebido por, Status do pedido de origem, Ações (Ver, **Imprimir**, Cancelar — reaproveitando `DELETE /purchase-receipts/:id` já existente). Botão "Novo Recebimento" no cabeçalho.

**Fluxo "Novo Recebimento":**
1. Buscar/selecionar um Pedido de Compra com status `CONFIRMED` ou `PARTIAL` (não `CANCELLED`, não já 100% `RECEIVED`) — precisa de um endpoint de listagem de pedidos filtrável por status; verificar se `GET /purchase-orders` já aceita esse filtro antes de assumir que precisa de mudança de backend.
2. Mostrar os itens do pedido com **Pendente = Quantidade Pedida − `receivedQty`** (não a quantidade total — ver seção de recebimento parcial abaixo).
3. Para cada item, campo de quantidade recebida começando em **0** (não pré-preenchido com o pendente), validado no front para não exceder o pendente — mesma regra que `purchase-receipt.service.ts::create()` já aplica no backend (linha ~121-129), replicada no front só para feedback imediato.
4. Campos por item de lote/fabricação/validade, exibidos **somente quando `product.lotTracked === true`** (o backend já rejeita com 400 a falta de `lotNumber` nesse caso — ver `createPurchaseReceiptSchema`).
5. Campos do recebimento: Data de Recebimento, Número da Nota Fiscal (opcional), Observações.
6. Opcional: **Importar XML de NFe** (seção 4) para pré-preencher os campos de quantidade/lote em vez de digitar.
7. Salvar → `POST /purchase-receipts` → sucesso → tela oferece **"Imprimir Comprovante"** (itens + `signature: { label: 'Recebido por' }`) e volta para a lista.

### 4. Importação de XML de NFe

- Só disponível **depois** de um Pedido de Compra já selecionado (decisão confirmada: recebimento sempre exige pedido vinculado — nenhuma mudança na regra atual do backend de `purchaseOrderId` obrigatório).
- **Parsing no backend**, novo endpoint `POST /purchase-receipts/parse-nfe` (multipart upload do XML; ou body com o XML como string — decidir na fase de plano). Mesma permissão `recebimentos_compra:criar`. Retorna: fornecedor (CNPJ, razão social), número/série da nota, e a lista de itens da NFe (código do fornecedor, descrição, quantidade, e lote/fabricação/validade quando a nota trouxer o grupo `rastro`).
- **Reconciliação é sempre manual** — não existe hoje campo de EAN nem código do fornecedor no cadastro de `Product`, então não há como casar os itens da NFe com os itens do pedido de forma confiável e automática. A tela lista os itens da NFe lado a lado com os itens do pedido; o usuário escolhe, para cada item da NFe, a qual item do pedido ele corresponde (o sistema pode sugerir por aproximação de nome como conveniência, nunca associando sozinho). Confirmado o casamento, quantidade e lote (se houver) pré-preenchem os campos do passo 3 acima, permanecendo editáveis.
- **Divergência de quantidade:** se a quantidade de um item da NFe for maior que o pendente daquele item no pedido, o item é sinalizado visualmente para revisão em vez de ser truncado silenciosamente ou deixado para o backend rejeitar sem contexto.
- Itens da NFe não confirmados pelo usuário **não** entram no recebimento.
- **Fast-follow deliberadamente fora deste spec:** adicionar campo de EAN e/ou tabela de código do fornecedor por produto para permitir casamento automático — é uma mudança de schema à parte, não necessária para a importação já ser útil na v1.

### 5. Recebimento parcial (já suportado pelo backend, precisa ser explícito na tela)

O backend já suporta: `PurchaseOrderItem.receivedQty` acumula entre múltiplos recebimentos do mesmo pedido; `purchase-order.service.ts` recalcula o status do pedido (`PARTIAL` quando `someReceived && !allReceived`, `RECEIVED` quando completo); validação server-side impede receber além do pendente. Nada disso precisa ser criado — precisa ser **respeitado** pela tela nova:

- Pendente por item = pedido − já recebido (recalculado a cada abertura da tela, não cacheado).
- Um pedido com status `PARTIAL` continua aparecendo na busca de "Novo Recebimento" (passo 1 do fluxo) até ficar `RECEIVED`.
- A lista de recebimentos (tela de lista) mostra o status atual do pedido de origem, para deixar claro quando ele ainda tem saldo pendente.

## Fora de escopo (deliberado)

- Tela de tarefas do WMS orientada a coletor (F4.12 + frontend mobile/PWA) — projeto futuro separado.
- Casamento automático de itens de NFe (exige campo de EAN/código do fornecedor no cadastro de produto — mudança de schema).
- Validação criptográfica de autenticidade da NFe (assinatura digital, consulta à SEFAZ) — o parsing lê só os dados estruturados do XML para agilizar o preenchimento, não valida se a nota é genuína.
- Impressão automática (abrir o PDF sozinho ao salvar) — decidido manual.
- Reescrever o PDF do Inventário (`CountingPlanForm.vue`) para usar o utilitário compartilhado em vez de jsPDF direto — inconsistência pré-existente, não within scope daqui.
- Corrigir a divergência de rótulo `warehouse_receipts` vs. `recebimentos_compra` em `PermissionsModal.vue` — observação registrada acima, cleanup separado.

## Riscos / pontos de atenção para o plano de implementação

- Confirmar se `GET /purchase-orders` já filtra por status antes de assumir que o passo 1 do fluxo de recebimento não precisa de mudança de backend.
- Formato exato do endpoint `parse-nfe` (multipart vs. XML no body) e escolha de biblioteca de parsing XML no backend — decidir na fase de plano, não neste spec.
- `receiptNumber` hoje é gerado com `count() + 1` (não atômico sob concorrência) — já registrado como problema conhecido em `WMS_IMPLEMENTATION_ANALYSIS.md` (item F4.7, ainda não implementado). Não é deste spec resolver, mas a tela nova vai expor esse número na lista/comprovante — vale linkar o achado no plano para não ser esquecido.
- `frontend/src/types/jspdf-autotable.d.ts` já existe — confirmar que a tabela de itens do comprovante de recebimento usa o mesmo padrão de `itemsColumns` do utilitário, sem precisar de tipo novo.
