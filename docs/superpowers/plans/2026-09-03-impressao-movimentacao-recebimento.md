# Impressão de Movimentação + Tela de Recebimento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Estoque (StockView) the ability to print a movement receipt, and build the "Recebimento" (purchase receiving) screen that has never existed in the frontend — including optional NFe XML import to speed up filling it in, and correct handling of partial receiving.

**Architecture:** Backend: a pure-function NFe XML parser (`nfe-parser.service.ts`) wired into a new `POST /purchase-receipts/parse-nfe` route on the existing, already-working `purchase-receipt` resource — no new tables, no change to the receipt-creation contract. Frontend: generalize the existing `pdf-generator.ts` utility (already used by Purchase Orders/Quotations) instead of inventing a new print mechanism; add print buttons to StockView; build the Recebimento screen (list + form) following the exact `AppLayout`/`FormField`/`AppModal`/`DataTable`/`StatusBadge` pattern every other view in the app already uses (see `docs/fase-2026-09-modernizacao/05_PADRAO_FRONTEND.md`).

**Tech Stack:** Vue 3 + `<script setup>` + TypeScript, Pinia, Tailwind (frontend); Express + Prisma + Joi + Jest/ts-jest (backend); `jsPDF`/`jspdf-autotable` (already a dependency) for printing; `fast-xml-parser` (new dependency) for NFe parsing.

## Global Constraints

- Backend errors always via `throw new AppError(status, message)` from `../middleware/error.middleware` in services — controllers stay `try { ... } catch (error) { return next(error); }`, no local error mapping.
- Every mutating route gets a Joi validator via `validate(schema)` from `../middleware/validation.middleware`, and `requirePermission(resource, action)` from `../middleware/permission.middleware` — this project has no route without both.
- Frontend: no `alert()`/`confirm()` — use `useToast()` (`@/composables/useToast`) and `confirmDialog()` (`@/composables/useConfirm`). Every new view wraps in `AppLayout`, uses `FormField` for labeled inputs, `DataTable` for real tables with independent loading/error state, `StatusBadge` for single-value status pills (5 tones only: success/danger/warning/neutral/info — no exact match, don't force it), `AppModal` for any modal.
- **Testing approach, decided deliberately for this plan:** the backend has an established Jest unit/integration test culture (`backend/tests/services/*.test.ts`, `backend/tests/integration/*.test.ts`) — new backend logic in this plan gets real tests in that style. The frontend, as it stands today, has **zero** Vitest specs for any view, service, or store — only the 5 shared `common/` design-system components are tested. Writing new frontend tests here would be inventing a testing pattern with no precedent to follow, so frontend tasks are verified the same way the whole 8-batch view migration was verified: `cd frontend && npm run type-check` must not exceed the current **47-error baseline** (run it once before Task 3 to capture the exact baseline count, then re-check after every frontend task), plus a manual dev-server/screenshot check at the end of each frontend task. **Known dev-server gotcha (see project memory `fabric-frontend-dev-server-staleness`):** the `fabric-frontend` Docker container's file watcher doesn't always pick up host-side edits live — if a screenshot doesn't reflect a change you just made, run `docker compose restart frontend` (from `D:\Fabric`) and re-check before assuming the code is wrong.
- Money/quantity fields in this codebase are `Float`, not `Decimal` (a known, deliberately-deferred debt, documented in `WMS_IMPLEMENTATION_ANALYSIS.md` §2.7) — new code in this plan follows the existing `Float` convention, does not introduce `Decimal` unilaterally.
- Backend dev server runs via Docker (`fabric-backend`, port 3005) with `tsx watch` — file edits hot-reload; if the container ever crash-loops on a "Cannot find module" error after adding a new npm dependency, run `docker compose exec backend npm install` before assuming something else is wrong (same class of issue as the earlier `nodemailer` incident, see project memory `fabric-frontend-migration-status`).

---

## Task 1: NFe XML parser (backend, pure logic)

**Files:**
- Create: `backend/src/services/nfe-parser.service.ts`
- Test: `backend/tests/services/nfe-parser.service.test.ts`
- Modify: `backend/package.json` (add `fast-xml-parser` dependency)

**Interfaces:**
- Produces: `parseNfeXml(xml: string): ParsedNfe`, `interface ParsedNfe { supplierCnpj: string; supplierName: string; number: string; series: string; items: ParsedNfeItem[] }`, `interface ParsedNfeItem { code: string; description: string; unit: string; quantity: number; unitValue: number; lotNumber?: string; manufacturedAt?: string; expiresAt?: string }` — Task 2 imports these directly.

- [ ] **Step 1: Add the `fast-xml-parser` dependency**

Run from `D:\Fabric`:
```bash
docker compose exec backend npm install fast-xml-parser@^4.5.0
```
Expected: `package.json` and `package-lock.json` under `backend/` gain the new dependency; the command exits 0.

- [ ] **Step 2: Write the failing test**

Create `backend/tests/services/nfe-parser.service.test.ts`:

```ts
import { parseNfeXml } from '../../src/services/nfe-parser.service';
import { AppError } from '../../src/middleware/error.middleware';

const VALID_NFE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe Id="NFe35260112345678000199550010000012345123456789" versao="4.00">
      <ide>
        <cUF>35</cUF>
        <nNF>12345</nNF>
        <serie>1</serie>
        <dhEmi>2026-09-01T10:00:00-03:00</dhEmi>
      </ide>
      <emit>
        <CNPJ>12345678000199</CNPJ>
        <xNome>Fornecedor Exemplo Ltda</xNome>
      </emit>
      <det nItem="1">
        <prod>
          <cProd>PROD-001</cProd>
          <xProd>Parafuso M6x20</xProd>
          <uCom>UN</uCom>
          <qCom>100.0000</qCom>
          <vUnCom>0.50</vUnCom>
          <rastro>
            <nLote>L2026-08</nLote>
            <dFab>2026-08-01</dFab>
            <dVal>2027-08-01</dVal>
          </rastro>
        </prod>
      </det>
      <det nItem="2">
        <prod>
          <cProd>PROD-002</cProd>
          <xProd>Chapa de Aço 2mm</xProd>
          <uCom>KG</uCom>
          <qCom>50.5000</qCom>
          <vUnCom>12.30</vUnCom>
        </prod>
      </det>
    </infNFe>
  </NFe>
</nfeProc>`;

describe('nfe-parser.service — parseNfeXml', () => {
  it('extrai fornecedor, número/série e itens de uma NFe válida', () => {
    const result = parseNfeXml(VALID_NFE_XML);

    expect(result.supplierCnpj).toBe('12345678000199');
    expect(result.supplierName).toBe('Fornecedor Exemplo Ltda');
    expect(result.number).toBe('12345');
    expect(result.series).toBe('1');
    expect(result.items).toHaveLength(2);
  });

  it('extrai os campos de cada item, incluindo lote quando presente', () => {
    const result = parseNfeXml(VALID_NFE_XML);

    expect(result.items[0]).toEqual({
      code: 'PROD-001',
      description: 'Parafuso M6x20',
      unit: 'UN',
      quantity: 100,
      unitValue: 0.5,
      lotNumber: 'L2026-08',
      manufacturedAt: '2026-08-01',
      expiresAt: '2027-08-01',
    });
  });

  it('item sem grupo rastro não traz campos de lote', () => {
    const result = parseNfeXml(VALID_NFE_XML);

    expect(result.items[1]).toEqual({
      code: 'PROD-002',
      description: 'Chapa de Aço 2mm',
      unit: 'KG',
      quantity: 50.5,
      unitValue: 12.3,
    });
  });

  it('NFe com um único item (det não vem como array) ainda funciona', () => {
    const singleItemXml = VALID_NFE_XML.replace(
      /<det nItem="2">[\s\S]*?<\/det>\s*/,
      ''
    );

    const result = parseNfeXml(singleItemXml);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].code).toBe('PROD-001');
  });

  it('rejeita XML malformado com AppError 400', () => {
    expect(() => parseNfeXml('<not><valid</xml>')).toThrow(AppError);
    expect(() => parseNfeXml('<not><valid</xml>')).toThrow(/inválido|malformado/i);
  });

  it('rejeita XML bem formado mas sem estrutura de NFe com AppError 400', () => {
    expect(() => parseNfeXml('<algumaCoisa><outra>valor</outra></algumaCoisa>')).toThrow(
      AppError
    );
  });

  it('rejeita NFe sem itens com AppError 400', () => {
    const noItemsXml = VALID_NFE_XML.replace(/<det nItem="1">[\s\S]*?<\/nfeProc>/, '</infNFe></NFe></nfeProc>');

    expect(() => parseNfeXml(noItemsXml)).toThrow(AppError);
  });
});
```

- [ ] **Step 2b: Run test to verify it fails**

Run: `docker compose exec backend npx jest tests/services/nfe-parser.service.test.ts`
Expected: FAIL — `Cannot find module '../../src/services/nfe-parser.service'`

- [ ] **Step 3: Write the implementation**

Create `backend/src/services/nfe-parser.service.ts`:

```ts
import { XMLParser } from 'fast-xml-parser';
import { AppError } from '../middleware/error.middleware';

/**
 * Parser puro de XML de NFe (modelo 55, layout 4.00) para a tela de
 * Recebimento. Lê só os campos estruturais necessários para pré-preencher o
 * formulário de conferência — NÃO valida assinatura digital nem consulta a
 * SEFAZ (ver spec, seção "Fora de escopo"). A reconciliação de cada item com
 * o pedido de compra é sempre manual no frontend (não há EAN nem código de
 * fornecedor cadastrados hoje — ver spec).
 */

export interface ParsedNfeItem {
  code: string;
  description: string;
  unit: string;
  quantity: number;
  unitValue: number;
  lotNumber?: string;
  manufacturedAt?: string;
  expiresAt?: string;
}

export interface ParsedNfe {
  supplierCnpj: string;
  supplierName: string;
  number: string;
  series: string;
  items: ParsedNfeItem[];
}

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

export function parseNfeXml(xml: string): ParsedNfe {
  let json: any;
  try {
    json = parser.parse(xml);
  } catch (err) {
    throw new AppError(400, 'XML inválido ou malformado');
  }

  // Aceita tanto o envelope completo (nfeProc, com protocolo de autorização
  // anexado) quanto só a NFe isolada — ambos são exportados pelos emissores
  // fiscais dependendo de como o usuário baixou o arquivo.
  const infNFe = json?.nfeProc?.NFe?.infNFe ?? json?.NFe?.infNFe;
  if (!infNFe) {
    throw new AppError(400, 'Estrutura de NFe não reconhecida (esperado nfeProc/NFe/infNFe)');
  }

  const emit = infNFe.emit;
  const ide = infNFe.ide;
  if (!emit?.CNPJ || !ide?.nNF) {
    throw new AppError(400, 'NFe sem emitente ou número da nota');
  }

  const detRaw = infNFe.det;
  const detList = Array.isArray(detRaw) ? detRaw : detRaw ? [detRaw] : [];
  if (detList.length === 0) {
    throw new AppError(400, 'NFe sem itens (det)');
  }

  const items: ParsedNfeItem[] = detList.map((det: any) => {
    const prod = det.prod;
    if (!prod?.cProd || !prod?.xProd || prod?.qCom === undefined) {
      const nItem = det?.['@_nItem'] ?? '?';
      throw new AppError(400, `Item ${nItem} da NFe sem código, descrição ou quantidade`);
    }

    const rastro = prod.rastro;
    const item: ParsedNfeItem = {
      code: String(prod.cProd),
      description: String(prod.xProd),
      unit: String(prod.uCom ?? ''),
      quantity: Number(prod.qCom),
      unitValue: Number(prod.vUnCom ?? 0),
    };
    if (rastro?.nLote) item.lotNumber = String(rastro.nLote);
    if (rastro?.dFab) item.manufacturedAt = String(rastro.dFab);
    if (rastro?.dVal) item.expiresAt = String(rastro.dVal);

    return item;
  });

  return {
    supplierCnpj: String(emit.CNPJ),
    supplierName: String(emit.xNome ?? ''),
    number: String(ide.nNF),
    series: String(ide.serie ?? ''),
    items,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `docker compose exec backend npx jest tests/services/nfe-parser.service.test.ts`
Expected: PASS — 7 tests green.

- [ ] **Step 5: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/src/services/nfe-parser.service.ts backend/tests/services/nfe-parser.service.test.ts
git commit -m "feat(backend): adiciona parser de XML de NFe para a tela de Recebimento

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: `POST /purchase-receipts/parse-nfe` route

**Files:**
- Modify: `backend/src/controllers/purchase-receipt.controller.ts`
- Modify: `backend/src/routes/purchase-receipt.routes.ts`
- Modify: `backend/src/validators/purchase-receipt.validator.ts`
- Modify: `backend/src/app.ts` (raise the global JSON body limit)
- Test: `backend/tests/integration/purchase-receipt-nfe.test.ts`

**Interfaces:**
- Consumes: `parseNfeXml(xml: string): ParsedNfe` from Task 1 (`../../src/services/nfe-parser.service`).
- Produces: `POST /purchase-receipts/parse-nfe` — body `{ xml: string }`, requires `recebimentos_compra:criar`, returns `{ status: 'success', data: ParsedNfe }` (200) or a JSON error body via the existing error middleware (400/401/403). Task 8 (frontend) calls this endpoint by name.

- [ ] **Step 1: Raise the global JSON body limit**

`backend/src/app.ts` currently has (confirmed at line 28):
```ts
app.use(express.json());
```

Change to:
```ts
// Limite default do Express (100kb) é pequeno demais para um XML de NFe com
// muitos itens (POST /purchase-receipts/parse-nfe, Fase de Recebimento).
app.use(express.json({ limit: '5mb' }));
```

- [ ] **Step 2: Add the Joi schema**

In `backend/src/validators/purchase-receipt.validator.ts`, add after the existing `cancelPurchaseReceiptSchema` export (end of file):

```ts
export const parseNfeSchema = Joi.object({
  xml: Joi.string().trim().min(1).required().messages({
    'any.required': 'Conteúdo do XML é obrigatório',
    'string.empty': 'Conteúdo do XML é obrigatório',
  }),
});
```

- [ ] **Step 3: Add the controller action**

In `backend/src/controllers/purchase-receipt.controller.ts`, add the import at the top:

```ts
import { parseNfeXml } from '../services/nfe-parser.service';
```

Add this method inside the `PurchaseReceiptController` class, after `create`:

```ts
  async parseNfe(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const parsed = parseNfeXml(req.body.xml);

      return res.status(200).json({
        status: 'success',
        data: parsed,
      });
    } catch (error) {
      return next(error);
    }
  }
```

- [ ] **Step 4: Add the route**

In `backend/src/routes/purchase-receipt.routes.ts`, add the import:

```ts
import { createPurchaseReceiptSchema, cancelPurchaseReceiptSchema, parseNfeSchema } from '../validators/purchase-receipt.validator';
```

Add the route before the existing `POST /` (fixed segment before the general create route, same discipline `warehouse-task.routes.ts` documents):

```ts
// Parse de XML de NFe para pré-preencher o formulário de recebimento —
// segmento fixo, registrado antes de qualquer rota paramétrica do arquivo.
router.post(
  '/parse-nfe',
  requirePermission('recebimentos_compra', 'criar'),
  validate(parseNfeSchema),
  purchaseReceiptController.parseNfe
);
```

- [ ] **Step 5: Write the failing integration test**

Create `backend/tests/integration/purchase-receipt-nfe.test.ts`. Setup pattern (auth helper, module-licensing helper, URL prefix `/api/v1/...`) copied verbatim from the existing `backend/tests/integration/wms-receipt-chain-4b.test.ts`, which authenticates against the same `recebimentos_compra` resource:

```ts
import request from 'supertest';
import { app } from '../../src/app';
import { cleanDatabase, disconnectTestDb, testPrisma } from '../helpers/db';
import { createUserWithPermissions } from '../helpers/fixtures';
import { clearLicensedModuleCache } from '../../src/services/licensed-module.service';

const RECEIPT_PERMISSIONS = [{ resource: 'recebimentos_compra', action: 'criar' }];

const setModule = (code: string, enabled: boolean) =>
  testPrisma.licensedModule.create({ data: { code, enabled } });

const login = async () => {
  const user = await createUserWithPermissions(RECEIPT_PERMISSIONS);
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: 'Test@Password123' });

  return { user, token: res.body.data.accessToken as string };
};

const VALID_NFE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe Id="NFe35260112345678000199550010000012345123456789" versao="4.00">
      <ide><cUF>35</cUF><nNF>777</nNF><serie>1</serie><dhEmi>2026-09-01T10:00:00-03:00</dhEmi></ide>
      <emit><CNPJ>12345678000199</CNPJ><xNome>Fornecedor Teste</xNome></emit>
      <det nItem="1">
        <prod><cProd>X1</cProd><xProd>Produto Teste</xProd><uCom>UN</uCom><qCom>10.0000</qCom><vUnCom>5.00</vUnCom></prod>
      </det>
    </infNFe>
  </NFe>
</nfeProc>`;

describe('POST /purchase-receipts/parse-nfe', () => {
  beforeEach(async () => {
    clearLicensedModuleCache();
    await setModule('COMPRAS', true);
    clearLicensedModuleCache();
  });

  afterEach(async () => {
    await cleanDatabase();
    clearLicensedModuleCache();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('retorna 200 com os dados extraídos para um usuário autorizado', async () => {
    const { token } = await login();

    const response = await request(app)
      .post('/api/v1/purchase-receipts/parse-nfe')
      .set('Authorization', `Bearer ${token}`)
      .send({ xml: VALID_NFE_XML });

    expect(response.status).toBe(200);
    expect(response.body.data.supplierCnpj).toBe('12345678000199');
    expect(response.body.data.items).toHaveLength(1);
  });

  it('retorna 400 para XML malformado', async () => {
    const { token } = await login();

    const response = await request(app)
      .post('/api/v1/purchase-receipts/parse-nfe')
      .set('Authorization', `Bearer ${token}`)
      .send({ xml: '<not><valid' });

    expect(response.status).toBe(400);
  });

  it('retorna 400 quando o campo xml não é enviado', async () => {
    const { token } = await login();

    const response = await request(app)
      .post('/api/v1/purchase-receipts/parse-nfe')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(response.status).toBe(400);
  });

  it('retorna 401 sem token de autenticação', async () => {
    const response = await request(app)
      .post('/api/v1/purchase-receipts/parse-nfe')
      .send({ xml: VALID_NFE_XML });

    expect(response.status).toBe(401);
  });
});
```

- [ ] **Step 6: Run test to verify it fails, then passes**

Run: `docker compose exec backend npx jest tests/integration/purchase-receipt-nfe.test.ts`
Expected first: FAIL (route doesn't exist yet if you write the test before the route — if you followed steps in order above, the route already exists, so this should already PASS; if it fails, check the copied auth boilerplate matches the reference file exactly).

- [ ] **Step 7: Run the full backend test suite to confirm no regressions**

Run: `docker compose exec backend npm test`
Expected: all suites pass, including the new ones.

- [ ] **Step 8: Commit**

```bash
git add backend/src/app.ts backend/src/controllers/purchase-receipt.controller.ts backend/src/routes/purchase-receipt.routes.ts backend/src/validators/purchase-receipt.validator.ts backend/tests/integration/purchase-receipt-nfe.test.ts
git commit -m "feat(backend): expoe POST /purchase-receipts/parse-nfe

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Generalize the shared PDF signature option

**Files:**
- Modify: `frontend/src/utils/pdf-generator.ts`
- Modify: `frontend/src/views/purchases/PurchaseOrdersView.vue:457`
- Modify: `frontend/src/views/purchases/PurchaseQuotationsView.vue:437`

**Interfaces:**
- Produces: `generatePDF(options)` where `options.signature?: { label: string }` replaces `options.supplierSignature?: boolean`. Tasks 4 and 8 pass their own `signature.label`.

- [ ] **Step 1: Capture the current type-check baseline**

Run: `cd frontend && npm run type-check 2>&1 | grep -c "error TS"`
Expected: some number (was 47 as of the last full verification on `main` — confirm and record the exact number now, since this plan's later steps compare against it).

- [ ] **Step 2: Change the interface and rendering logic**

In `frontend/src/utils/pdf-generator.ts`, change:

```ts
interface PdfOptions {
  title: string;
  subtitle?: string;
  data: Record<string, any>;
  items?: Array<Record<string, any>>;
  itemsColumns?: Array<{ header: string; key: string; align?: 'left' | 'center' | 'right' }>;
  supplierSignature?: boolean;
}
```

to:

```ts
interface PdfOptions {
  title: string;
  subtitle?: string;
  data: Record<string, any>;
  items?: Array<Record<string, any>>;
  itemsColumns?: Array<{ header: string; key: string; align?: 'left' | 'center' | 'right' }>;
  signature?: { label: string };
}
```

Then change:
```ts
export const generatePDF = (options: PdfOptions) => {
  const { title, subtitle, data, items, itemsColumns, supplierSignature = false } = options;
```
to:
```ts
export const generatePDF = (options: PdfOptions) => {
  const { title, subtitle, data, items, itemsColumns, signature } = options;
```

Then find the block that starts with `// Rodapé com assinatura do fornecedor (se solicitado)` and change:
```ts
  // Rodapé com assinatura do fornecedor (se solicitado)
  if (supplierSignature) {
```
to:
```ts
  // Rodapé com assinatura (se solicitado) — rótulo customizável: comprovantes
  // de movimentação/recebimento usam "Assinatura de Quem Executou"/"Recebido
  // por", os documentos de compra usam "Assinatura do Fornecedor".
  if (signature) {
```

A few lines further down in that same block, change:
```ts
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Assinatura do Fornecedor:', margin, yPosition);
    yPosition += 15;
```
to:
```ts
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`${signature.label}:`, margin, yPosition);
    yPosition += 15;
```

- [ ] **Step 3: Update the two existing call sites**

In `frontend/src/views/purchases/PurchaseOrdersView.vue`, find (around line 457):
```ts
      supplierSignature: true,
```
Change to:
```ts
      signature: { label: 'Assinatura do Fornecedor' },
```

In `frontend/src/views/purchases/PurchaseQuotationsView.vue`, find the identical line (around line 437) and apply the identical change.

- [ ] **Step 4: Type-check**

Run: `cd frontend && npm run type-check 2>&1 | grep -c "error TS"`
Expected: same count as Step 1 (no new errors — this is a pure rename/type change, both call sites updated).

- [ ] **Step 5: Manual verification**

Start the app (`docker compose ps` from `D:\Fabric` to confirm `fabric-frontend`/`fabric-backend` are up; `docker compose restart frontend` if you just edited and a screenshot looks stale), open `/purchases/orders`, open an existing order, click the print action, confirm the generated PDF still shows "Assinatura do Fornecedor:" at the bottom exactly as before. Repeat for `/purchases/quotations`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/utils/pdf-generator.ts frontend/src/views/purchases/PurchaseOrdersView.vue frontend/src/views/purchases/PurchaseQuotationsView.vue
git commit -m "refactor(frontend): generaliza o rotulo de assinatura do PDF compartilhado

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: StockView — print movement receipts

**Files:**
- Modify: `frontend/src/views/stock/StockView.vue`

**Interfaces:**
- Consumes: `generatePDF` (Task 3's new `signature: { label }` shape), `StockMovement` type from `@/services/stock.service`.

- [ ] **Step 1: Import the PDF utility and add a helper to print one movement**

In `frontend/src/views/stock/StockView.vue`, in the `<script setup>` block, add to the imports (after the existing `import { useToast } from '@/composables/useToast';` line):

```ts
import { generatePDF, formatDate as formatDatePDF } from '@/utils/pdf-generator';
```

Add this function after the existing `formatDateTime` function (end of the script block):

```ts
function printMovementReceipt(movement: {
  type: string;
  quantity: number;
  reason: string;
  reference?: string;
  createdAt: string;
}, productLabel: string) {
  const pdf = generatePDF({
    title: 'Comprovante de Movimentação de Estoque',
    subtitle: productLabel,
    data: {
      Tipo: getMovementTypeLabel(movement.type),
      Quantidade: String(movement.quantity),
      Motivo: movement.reason,
      Referência: movement.reference || '-',
      Data: formatDatePDF(movement.createdAt),
      Usuário: authStore.userName,
    },
    signature: { label: 'Assinatura de Quem Executou' },
  });

  pdf.save(`Movimentacao_${movement.type}_${new Date(movement.createdAt).getTime()}.pdf`);
}
```

This function needs `authStore` — add it to the script setup, right after the existing `const toast = useToast();` line:

```ts
import { useAuthStore } from '@/stores/auth.store';
```
(add to imports)
```ts
const authStore = useAuthStore();
```
(add to setup body, next to `const toast = useToast();`)

- [ ] **Step 2: Wire up printing right after a successful registration**

The three handlers (`handleRegisterEntry`, `handleRegisterExit`, `handleRegisterAdjustment`) currently close the modal and reset the form immediately on success. Change each to keep a reference to the just-created movement and offer a print action via the toast itself is not supported by this project's toast API (plain messages only) — instead, add one small always-visible "last movement" print affordance under the action buttons.

Replace the `<template #actions>` block (lines 3-9) with:

```vue
    <template #actions>
      <div class="flex items-center space-x-2">
        <Button
          v-if="lastMovement"
          variant="outline"
          @click="printMovementReceipt(lastMovement, lastMovementProductLabel)"
        >
          🖨️ Imprimir Último Comprovante
        </Button>
        <Button variant="outline" @click="showMovementModal = true">⬆️ Entrada</Button>
        <Button variant="outline" @click="showExitModal = true">⬇️ Saída</Button>
        <Button @click="showAdjustmentModal = true">🔧 Ajuste</Button>
      </div>
    </template>
```

Add the two new refs next to the existing `const movements = ref<StockMovement[]>([]);` line:

```ts
const lastMovement = ref<StockMovement | null>(null);
const lastMovementProductLabel = ref('');
```

Change `handleRegisterEntry` from:
```ts
async function handleRegisterEntry() {
  try {
    await stockStore.registerEntry(movementForm.value);
    showMovementModal.value = false;
    movementForm.value = { productId: '', quantity: 0, reason: '', reference: '' };
    await loadData();
    toast.success('Entrada registrada com sucesso!');
  } catch (error) {
    console.error('Erro ao registrar entrada:', error);
    toast.error('Erro ao registrar entrada');
  }
}
```
to:
```ts
async function handleRegisterEntry() {
  try {
    const productId = movementForm.value.productId;
    const created = await stockStore.registerEntry(movementForm.value);
    lastMovement.value = created;
    lastMovementProductLabel.value = productId;
    showMovementModal.value = false;
    movementForm.value = { productId: '', quantity: 0, reason: '', reference: '' };
    await loadData();
    toast.success('Entrada registrada com sucesso! Use "Imprimir Último Comprovante" se precisar do papel.');
  } catch (error) {
    console.error('Erro ao registrar entrada:', error);
    toast.error('Erro ao registrar entrada');
  }
}
```

Change `handleRegisterExit` from:
```ts
async function handleRegisterExit() {
  try {
    await stockStore.registerExit(exitForm.value);
    showExitModal.value = false;
    exitForm.value = { productId: '', quantity: 0, reason: '', reference: '' };
    await loadData();
    toast.success('Saída registrada com sucesso!');
  } catch (error) {
    console.error('Erro ao registrar saída:', error);
    toast.error('Erro ao registrar saída');
  }
}
```
to:
```ts
async function handleRegisterExit() {
  try {
    const productId = exitForm.value.productId;
    const created = await stockStore.registerExit(exitForm.value);
    lastMovement.value = created;
    lastMovementProductLabel.value = productId;
    showExitModal.value = false;
    exitForm.value = { productId: '', quantity: 0, reason: '', reference: '' };
    await loadData();
    toast.success('Saída registrada com sucesso! Use "Imprimir Último Comprovante" se precisar do papel.');
  } catch (error) {
    console.error('Erro ao registrar saída:', error);
    toast.error('Erro ao registrar saída');
  }
}
```

Change `handleRegisterAdjustment` from:
```ts
async function handleRegisterAdjustment() {
  try {
    await stockStore.registerAdjustment(adjustmentForm.value);
    showAdjustmentModal.value = false;
    adjustmentForm.value = { productId: '', quantity: 0, reason: '' };
    await loadData();
    toast.success('Ajuste registrado com sucesso!');
  } catch (error) {
    console.error('Erro ao registrar ajuste:', error);
    toast.error('Erro ao registrar ajuste');
  }
}
```
to:
```ts
async function handleRegisterAdjustment() {
  try {
    const productId = adjustmentForm.value.productId;
    const created = await stockStore.registerAdjustment(adjustmentForm.value);
    lastMovement.value = created;
    lastMovementProductLabel.value = productId;
    showAdjustmentModal.value = false;
    adjustmentForm.value = { productId: '', quantity: 0, reason: '' };
    await loadData();
    toast.success('Ajuste registrado com sucesso! Use "Imprimir Último Comprovante" se precisar do papel.');
  } catch (error) {
    console.error('Erro ao registrar ajuste:', error);
    toast.error('Erro ao registrar ajuste');
  }
}
```

Confirmed: `frontend/src/stores/stock.store.ts`'s `registerEntry`/`registerExit`/`registerAdjustment` actions (lines 99-139) already `return movement;` in every case — no changes needed there, the code above can rely on the store call's return value directly.

- [ ] **Step 3: Add a per-row reprint action in the movements history table**

In the `#row` template of the movements `DataTable` (inside the `showMovementsModal`), the current last column is:
```vue
          <td class="px-4 py-2 text-sm text-gray-500">{{ item.reference || '-' }}</td>
```
Change this row's `<template #row="{ item }">` block to add one more `<td>` after it, and add a matching `<th>` to `#head`:

```vue
        <th scope="col" class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
```
(added to the end of the existing `#head` template, after the "Referência" `<th>`)

```vue
          <td class="px-4 py-2 text-right text-sm">
            <button
              class="text-primary-600 hover:text-primary-900 font-medium"
              @click="printMovementReceipt(item, movementsProductLabel)"
            >
              Imprimir
            </button>
          </td>
```
(added to the end of the existing `#row` template, after the "Referência" `<td>`)

This needs `movementsProductLabel` (the product being viewed in the history modal) — add next to the existing `const movementsProductId = ref('');` line:
```ts
const movementsProductLabel = ref('');
```
And set it inside `viewMovements`, which currently is:
```ts
function viewMovements(productId: string) {
  movementsProductId.value = productId;
  showMovementsModal.value = true;
  return loadMovements(productId);
}
```
Change to:
```ts
function viewMovements(productId: string) {
  movementsProductId.value = productId;
  const balance = balances.value.find((b) => b.productId === productId);
  movementsProductLabel.value = balance ? `${balance.product.code} - ${balance.product.name}` : productId;
  showMovementsModal.value = true;
  return loadMovements(productId);
}
```

- [ ] **Step 4: Type-check**

Run: `cd frontend && npm run type-check 2>&1 | grep -c "error TS"`
Expected: same baseline count as Task 3 Step 1, zero new errors in `StockView.vue`.

- [ ] **Step 5: Manual verification**

Open `/stock`, register a test Entrada, confirm the "🖨️ Imprimir Último Comprovante" button appears in the header and produces a PDF with the right data and an "Assinatura de Quem Executou:" line at the bottom. Open "Ver Movimentações" for any product with existing movements, confirm each row now has an "Imprimir" action that produces the same style of PDF for that specific historical movement.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/views/stock/StockView.vue
git commit -m "feat(frontend): StockView imprime comprovante de movimentacao

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: `purchase-receipt.service.ts` + `lotTracked` on the order-item product type

**Files:**
- Create: `frontend/src/services/purchase-receipt.service.ts`
- Modify: `frontend/src/services/purchase-order.service.ts`

**Interfaces:**
- Produces: `PurchaseReceiptService` default export with `getAll`, `getById`, `create`, `cancel`, `parseNfe`; types `PurchaseReceipt`, `PurchaseReceiptItem`, `CreatePurchaseReceiptDto`, `ParsedNfe`, `ParsedNfeItem`. Task 6 (store) and Task 8 (form view) import these.
- Modifies: `PurchaseOrderItem.product` in `purchase-order.service.ts` gains `lotTracked?: boolean` — Task 8 reads `item.product?.lotTracked` to decide whether to show lot fields.

- [ ] **Step 1: Add `lotTracked` to the existing product type**

In `frontend/src/services/purchase-order.service.ts`, the `PurchaseOrderItem` interface currently has:
```ts
  product?: {
    id: string;
    code: string;
    name: string;
    unit: {
      symbol: string;
    };
  };
```
Change to:
```ts
  product?: {
    id: string;
    code: string;
    name: string;
    lotTracked?: boolean;
    unit: {
      symbol: string;
    };
  };
```

- [ ] **Step 2: Create the new service file**

Create `frontend/src/services/purchase-receipt.service.ts`:

```ts
import api from './api.service';

export interface PurchaseReceiptItem {
  id: string;
  receiptId: string;
  orderItemId: string;
  productId: string;
  quantity: number;
  acceptedQty: number;
  rejectedQty: number;
  notes?: string;
  lotNumber?: string;
  manufacturedAt?: string;
  expiresAt?: string;
  product?: {
    id: string;
    code: string;
    name: string;
  };
}

export interface PurchaseReceipt {
  id: string;
  receiptNumber: string;
  orderId: string;
  receiptDate: string;
  receivedBy: string;
  status: string;
  notes?: string;
  createdAt: string;
  order?: {
    id: string;
    orderNumber: string;
    status: string;
    supplier?: {
      code: string;
      name: string;
    };
  };
  items: PurchaseReceiptItem[];
}

export interface CreatePurchaseReceiptDto {
  purchaseOrderId: string;
  receiptDate: string;
  invoiceNumber?: string;
  notes?: string;
  items: {
    orderItemId: string;
    productId: string;
    quantityReceived: number;
    notes?: string;
    lotNumber?: string;
    manufacturedAt?: string;
    expiresAt?: string;
  }[];
}

export interface ParsedNfeItem {
  code: string;
  description: string;
  unit: string;
  quantity: number;
  unitValue: number;
  lotNumber?: string;
  manufacturedAt?: string;
  expiresAt?: string;
}

export interface ParsedNfe {
  supplierCnpj: string;
  supplierName: string;
  number: string;
  series: string;
  items: ParsedNfeItem[];
}

class PurchaseReceiptService {
  private readonly basePath = '/purchase-receipts';

  async getAll(filters?: { purchaseOrderId?: string; startDate?: string; endDate?: string }) {
    const params = new URLSearchParams();
    if (filters?.purchaseOrderId) params.append('purchaseOrderId', filters.purchaseOrderId);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    const query = params.toString();
    return api.get(`${this.basePath}${query ? `?${query}` : ''}`);
  }

  async getById(id: string) {
    return api.get(`${this.basePath}/${id}`);
  }

  async create(data: CreatePurchaseReceiptDto) {
    return api.post(this.basePath, data);
  }

  async cancel(id: string, reason: string) {
    return api.delete(`${this.basePath}/${id}`, { data: { reason } });
  }

  async parseNfe(xml: string): Promise<ParsedNfe> {
    const response = await api.post(`${this.basePath}/parse-nfe`, { xml });
    return response.data.data;
  }
}

export default new PurchaseReceiptService();
```

Note `cancel`'s `DELETE` with a body: confirm `api.service.ts`'s underlying axios instance supports `api.delete(url, { data })` (standard axios `AxiosRequestConfig.data` on a DELETE — it does, no change needed there) before moving on.

- [ ] **Step 3: Type-check**

Run: `cd frontend && npm run type-check 2>&1 | grep -c "error TS"`
Expected: same baseline as Task 4 (this task only adds a new, currently-unused file plus one optional field — nothing should newly break).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/services/purchase-receipt.service.ts frontend/src/services/purchase-order.service.ts
git commit -m "feat(frontend): adiciona purchase-receipt.service.ts e lotTracked ao tipo de item de pedido

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: `purchase-receipt.store.ts` (Pinia)

**Files:**
- Create: `frontend/src/stores/purchase-receipt.store.ts`

**Interfaces:**
- Consumes: `purchaseReceiptService` (Task 5).
- Produces: `usePurchaseReceiptStore()` with state `receipts`, `loading`, `error` and actions `fetchReceipts`, `getReceiptById`, `createReceipt`, `cancelReceipt`, `parseNfe`. Task 7 (list view) and Task 8 (form view) use this store exclusively — they do not call `purchaseReceiptService` directly.

- [ ] **Step 1: Create the store**

Create `frontend/src/stores/purchase-receipt.store.ts`, mirroring `frontend/src/stores/purchase-order.store.ts`'s exact shape (composition-API Pinia store, `loading`/`error` reset at the start of every action, `error.value = err.response?.data?.message || '<mensagem>'` in every catch):

```ts
import { defineStore } from 'pinia';
import { ref } from 'vue';
import purchaseReceiptService, {
  type PurchaseReceipt,
  type CreatePurchaseReceiptDto,
  type ParsedNfe,
} from '@/services/purchase-receipt.service';

export const usePurchaseReceiptStore = defineStore('purchaseReceipt', () => {
  const receipts = ref<PurchaseReceipt[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchReceipts(filters?: {
    purchaseOrderId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    loading.value = true;
    error.value = null;
    try {
      const response = await purchaseReceiptService.getAll(filters);
      receipts.value = response.data.data;
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao buscar recebimentos';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function getReceiptById(id: string) {
    loading.value = true;
    error.value = null;
    try {
      const response = await purchaseReceiptService.getById(id);
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao buscar recebimento';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function createReceipt(data: CreatePurchaseReceiptDto) {
    loading.value = true;
    error.value = null;
    try {
      const response = await purchaseReceiptService.create(data);
      await fetchReceipts();
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao registrar recebimento';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function cancelReceipt(id: string, reason: string) {
    loading.value = true;
    error.value = null;
    try {
      await purchaseReceiptService.cancel(id, reason);
      await fetchReceipts();
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao cancelar recebimento';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function parseNfe(xml: string): Promise<ParsedNfe> {
    loading.value = true;
    error.value = null;
    try {
      return await purchaseReceiptService.parseNfe(xml);
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao ler XML da NFe';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  return {
    receipts,
    loading,
    error,
    fetchReceipts,
    getReceiptById,
    createReceipt,
    cancelReceipt,
    parseNfe,
  };
});
```

- [ ] **Step 2: Type-check**

Run: `cd frontend && npm run type-check 2>&1 | grep -c "error TS"`
Expected: same baseline (new, currently-unimported file).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/stores/purchase-receipt.store.ts
git commit -m "feat(frontend): adiciona purchase-receipt.store.ts

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: `PurchaseReceiptsView.vue` (list) + navigation

**Files:**
- Create: `frontend/src/views/purchases/PurchaseReceiptsView.vue`
- Modify: `frontend/src/router/index.ts`
- Modify: `frontend/src/views/DashboardView.vue:266-272`

**Interfaces:**
- Consumes: `usePurchaseReceiptStore()` (Task 6).

- [ ] **Step 1: Create the list view**

Create `frontend/src/views/purchases/PurchaseReceiptsView.vue`:

```vue
<template>
  <AppLayout title="Recebimentos" subtitle="Consulte e gerencie os recebimentos de mercadorias">
    <template #actions>
      <RouterLink
        to="/purchases/receipts/new"
        class="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md shadow-sm"
      >
        + Novo Recebimento
      </RouterLink>
    </template>

    <DataTable
      :loading="loading"
      :error="error"
      :items="receipts"
      empty-title="Nenhum recebimento encontrado"
      empty-hint="Registre o recebimento de um pedido de compra pendente."
      @retry="loadReceipts"
    >
      <template #head>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Número</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pedido</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status do Pedido</th>
        <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
      </template>

      <template #row="{ item }">
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ item.receiptNumber }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{{ item.order?.orderNumber || '-' }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{{ formatDate(item.receiptDate) }}</td>
        <td class="px-6 py-4 whitespace-nowrap">
          <StatusBadge :label="getOrderStatusLabel(item.order?.status)" :tone="getOrderStatusTone(item.order?.status)" />
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-right text-sm">
          <div class="flex justify-end gap-3">
            <button class="text-primary-600 hover:text-primary-900 font-medium" @click="printReceipt(item)">
              Imprimir
            </button>
            <button class="text-red-600 hover:text-red-900 font-medium" @click="handleCancel(item)">
              Cancelar
            </button>
          </div>
        </td>
      </template>
    </DataTable>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { usePurchaseReceiptStore } from '@/stores/purchase-receipt.store';
import type { PurchaseReceipt } from '@/services/purchase-receipt.service';
import AppLayout from '@/components/common/AppLayout.vue';
import DataTable from '@/components/common/DataTable.vue';
import StatusBadge, { type BadgeTone } from '@/components/common/StatusBadge.vue';
import { generatePDF, formatDate as formatDatePDF } from '@/utils/pdf-generator';
import { useToast } from '@/composables/useToast';
import { confirmDialog } from '@/composables/useConfirm';

const receiptStore = usePurchaseReceiptStore();
const toast = useToast();

const receipts = ref<PurchaseReceipt[]>([]);
const loading = ref(false);
const error = ref('');

onMounted(loadReceipts);

async function loadReceipts() {
  loading.value = true;
  error.value = '';
  try {
    await receiptStore.fetchReceipts();
    receipts.value = receiptStore.receipts;
  } catch (e: any) {
    error.value = e.response?.data?.message || e.message || 'Erro ao carregar recebimentos';
  } finally {
    loading.value = false;
  }
}

// Mesmo mapeamento de cor de PurchaseOrder.status usado em PurchaseOrdersView.
const ORDER_STATUS_TONES: Record<string, BadgeTone> = {
  PENDING: 'neutral',
  CONFIRMED: 'info',
  PARTIAL: 'warning',
  RECEIVED: 'success',
  CANCELLED: 'danger',
};

const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendente',
  CONFIRMED: 'Confirmado',
  PARTIAL: 'Parcial',
  RECEIVED: 'Recebido',
  CANCELLED: 'Cancelado',
};

function getOrderStatusTone(status?: string): BadgeTone {
  return (status && ORDER_STATUS_TONES[status]) || 'neutral';
}

function getOrderStatusLabel(status?: string): string {
  return (status && ORDER_STATUS_LABELS[status]) || status || '-';
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('pt-BR');
}

function printReceipt(receipt: PurchaseReceipt) {
  const pdf = generatePDF({
    title: 'Comprovante de Recebimento',
    subtitle: receipt.receiptNumber,
    data: {
      Pedido: receipt.order?.orderNumber || '-',
      Fornecedor: receipt.order?.supplier?.name || '-',
      Data: formatDatePDF(receipt.receiptDate),
      Observações: receipt.notes || 'Nenhuma',
    },
    items: receipt.items.map((item) => ({
      produto: item.product ? `${item.product.code} - ${item.product.name}` : item.productId,
      quantidade: item.quantity,
      aceito: item.acceptedQty,
      lote: item.lotNumber || '-',
    })),
    itemsColumns: [
      { header: 'Produto', key: 'produto', align: 'left' },
      { header: 'Quantidade', key: 'quantidade', align: 'right' },
      { header: 'Aceito', key: 'aceito', align: 'right' },
      { header: 'Lote', key: 'lote', align: 'left' },
    ],
    signature: { label: 'Recebido por' },
  });

  pdf.save(`Recebimento_${receipt.receiptNumber}.pdf`);
}

async function handleCancel(receipt: PurchaseReceipt) {
  if (!(await confirmDialog(`Cancelar o recebimento ${receipt.receiptNumber}? Esta ação estorna o estoque recebido.`))) {
    return;
  }
  const reason = 'Cancelado pelo usuário';
  try {
    await receiptStore.cancelReceipt(receipt.id, reason);
    toast.success('Recebimento cancelado com sucesso!');
    await loadReceipts();
  } catch (e: any) {
    toast.error(e.response?.data?.message || 'Erro ao cancelar recebimento');
  }
}
</script>
```

- [ ] **Step 2: Register the route**

In `frontend/src/router/index.ts`, add after the existing `/purchases/orders` route block (confirmed at lines 112-117):

```ts
  {
    path: '/purchases/receipts',
    name: 'purchase-receipts',
    component: () => import('../views/purchases/PurchaseReceiptsView.vue'),
    meta: { requiresAuth: true }
  },
```

- [ ] **Step 3: Wire up the Dashboard's WMS "Recebimento" card**

In `frontend/src/views/DashboardView.vue`, the WMS tab currently has (confirmed at lines 266-271):
```vue
            <div class="p-4 border-2 border-gray-200 rounded-lg bg-gray-50 opacity-50 cursor-not-allowed">
              <div class="text-center">
                <div class="text-3xl mb-2">📦</div>
                <p class="text-sm font-medium text-gray-500">Recebimento</p>
                <p class="text-xs text-gray-400 mt-1">Em breve</p>
              </div>
            </div>
```
Change to (matching the live-link pattern every other WMS card in that same list already uses, e.g. the "Armazéns"/"Estruturas de Armazém" `RouterLink`s immediately above it):
```vue
            <RouterLink
              to="/purchases/receipts"
              class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer"
            >
              <div class="text-center">
                <div class="text-3xl mb-2">📦</div>
                <p class="text-sm font-medium text-gray-700">Recebimento</p>
              </div>
            </RouterLink>
```

- [ ] **Step 4: Type-check**

Run: `cd frontend && npm run type-check 2>&1 | grep -c "error TS"`
Expected: same baseline, zero new errors in the 3 touched files.

- [ ] **Step 5: Manual verification**

`docker compose restart frontend` if needed (see Global Constraints note on dev-server staleness), then log in, open the Dashboard's WMS tab, click "Recebimento", confirm it navigates to `/purchases/receipts` and renders the (likely empty) list with the "+ Novo Recebimento" button visible. Screenshot it.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/views/purchases/PurchaseReceiptsView.vue frontend/src/router/index.ts frontend/src/views/DashboardView.vue
git commit -m "feat(frontend): tela de lista de Recebimentos + link no Dashboard

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: `PurchaseReceiptFormView.vue` (new receipt: order picker, items, NFe import, partial receiving)

**Files:**
- Create: `frontend/src/views/purchases/PurchaseReceiptFormView.vue`
- Modify: `frontend/src/router/index.ts`

**Interfaces:**
- Consumes: `usePurchaseReceiptStore()` (Task 6), `usePurchaseOrderStore()` (existing, `frontend/src/stores/purchase-order.store.ts`), `PurchaseOrder`/`PurchaseOrderItem` types (Task 5's `lotTracked` addition).

- [ ] **Step 1: Create the form view**

Create `frontend/src/views/purchases/PurchaseReceiptFormView.vue`:

```vue
<template>
  <AppLayout title="Novo Recebimento" subtitle="Registre o recebimento de um pedido de compra">
    <!-- Passo 1: selecionar o pedido -->
    <Card v-if="!selectedOrder" class="mb-6">
      <FormField id="receipt-order-search" label="Buscar Pedido de Compra" hint="Só pedidos Confirmados ou Parcialmente recebidos aparecem aqui.">
        <input
          v-model="orderSearch"
          type="text"
          placeholder="Número do pedido ou fornecedor..."
          class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
        />
      </FormField>

      <div v-if="loadingOrders" class="text-center py-8 text-gray-500">Carregando pedidos...</div>
      <div v-else-if="filteredOrders.length === 0" class="text-center py-8 text-gray-500">
        Nenhum pedido pendente de recebimento encontrado.
      </div>
      <div v-else class="mt-4 space-y-2">
        <button
          v-for="order in filteredOrders"
          :key="order.id"
          type="button"
          class="w-full text-left p-4 border border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50"
          @click="selectOrder(order)"
        >
          <div class="flex justify-between items-center">
            <div>
              <p class="font-medium text-gray-900">{{ order.orderNumber }} — {{ order.supplier?.name }}</p>
              <p class="text-sm text-gray-500">Pedido em {{ formatDate(order.orderDate) }}</p>
            </div>
            <StatusBadge :label="getOrderStatusLabel(order.status)" :tone="getOrderStatusTone(order.status)" />
          </div>
        </button>
      </div>
    </Card>

    <!-- Passo 2: itens do pedido + NFe -->
    <template v-else>
      <Card class="mb-6">
        <div class="flex justify-between items-start mb-4">
          <div>
            <h3 class="text-lg font-semibold text-gray-900">{{ selectedOrder.orderNumber }} — {{ selectedOrder.supplier?.name }}</h3>
            <p class="text-sm text-gray-500">Preencha a quantidade recebida por item, ou importe o XML da NFe.</p>
          </div>
          <button type="button" class="text-sm text-primary-600 hover:text-primary-900" @click="selectedOrder = null">
            Trocar pedido
          </button>
        </div>

        <div class="flex items-center gap-3 mb-4 p-4 bg-gray-50 rounded-lg">
          <FormField id="receipt-nfe-file" label="Importar XML de NFe (opcional)" class="flex-1">
            <input
              ref="nfeFileInput"
              type="file"
              accept=".xml"
              class="w-full text-sm"
              @change="handleNfeFileSelected"
            />
          </FormField>
        </div>

        <!-- Reconciliação da NFe: aparece só depois de um import bem-sucedido -->
        <div v-if="parsedNfe" class="mb-6 border border-blue-200 bg-blue-50 rounded-lg p-4">
          <p class="text-sm font-medium text-blue-900 mb-3">
            NFe {{ parsedNfe.number }}/{{ parsedNfe.series }} — {{ parsedNfe.supplierName }} ({{ parsedNfe.items.length }} itens).
            Associe cada item da nota a um item do pedido:
          </p>
          <div v-for="(nfeItem, idx) in parsedNfe.items" :key="idx" class="flex items-center gap-3 py-2 border-t border-blue-100 first:border-t-0">
            <div class="flex-1 text-sm">
              <span class="font-medium">{{ nfeItem.code }}</span> — {{ nfeItem.description }}
              ({{ nfeItem.quantity }} {{ nfeItem.unit }})
            </div>
            <select
              class="rounded-lg border-gray-300 shadow-sm text-sm"
              :value="nfeMatches[idx] ?? ''"
              @change="applyNfeMatch(idx, ($event.target as HTMLSelectElement).value)"
            >
              <option value="">Não corresponde a nenhum item</option>
              <option v-for="row in itemRows" :key="row.orderItemId" :value="row.orderItemId">
                {{ row.productLabel }} (pendente: {{ row.pending }})
              </option>
            </select>
          </div>
        </div>

        <!-- Itens do pedido -->
        <div class="space-y-4">
          <div v-for="row in itemRows" :key="row.orderItemId" class="border border-gray-200 rounded-lg p-4">
            <div class="flex justify-between items-start mb-3">
              <div>
                <p class="font-medium text-gray-900">{{ row.productLabel }}</p>
                <p class="text-sm text-gray-500">Pedido: {{ row.orderedQty }} | Já recebido: {{ row.receivedQty }} | Pendente: {{ row.pending }}</p>
              </div>
              <span v-if="row.nfeDivergence" class="text-xs font-medium text-orange-700 bg-orange-100 px-2 py-1 rounded">
                Quantidade da NFe ({{ row.nfeQuantity }}) excede o pendente — revise
              </span>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField :id="`receipt-item-qty-${row.orderItemId}`" label="Quantidade Recebida">
                <input
                  v-model.number="row.quantityReceived"
                  type="number"
                  min="0"
                  :max="row.pending"
                  step="0.01"
                  class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                />
              </FormField>
              <template v-if="row.lotTracked">
                <FormField :id="`receipt-item-lot-${row.orderItemId}`" label="Número do Lote" required>
                  <input
                    v-model="row.lotNumber"
                    type="text"
                    class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  />
                </FormField>
                <FormField :id="`receipt-item-expires-${row.orderItemId}`" label="Validade">
                  <input
                    v-model="row.expiresAt"
                    type="date"
                    class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  />
                </FormField>
              </template>
            </div>
          </div>
        </div>
      </Card>

      <Card class="mb-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField id="receipt-date" label="Data de Recebimento" required>
            <input
              v-model="receiptDate"
              type="date"
              required
              class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            />
          </FormField>
          <FormField id="receipt-invoice" label="Número da Nota Fiscal (opcional)">
            <input
              v-model="invoiceNumber"
              type="text"
              class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            />
          </FormField>
        </div>
        <FormField id="receipt-notes" label="Observações" class="mt-4">
          <textarea
            v-model="notes"
            rows="3"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
          ></textarea>
        </FormField>
      </Card>

      <div v-if="!createdReceipt" class="flex justify-end gap-3">
        <RouterLink
          to="/purchases/receipts"
          class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Cancelar
        </RouterLink>
        <Button :disabled="submitting || !hasAnyQuantity" @click="handleSubmit">
          {{ submitting ? 'Salvando...' : 'Registrar Recebimento' }}
        </Button>
      </div>

      <Card v-else class="text-center py-8">
        <p class="text-lg font-medium text-gray-900 mb-4">Recebimento {{ createdReceipt.receiptNumber }} registrado com sucesso!</p>
        <div class="flex justify-center gap-3">
          <Button variant="outline" @click="printCreatedReceipt">🖨️ Imprimir Comprovante</Button>
          <RouterLink
            to="/purchases/receipts"
            class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            Voltar para a Lista
          </RouterLink>
        </div>
      </Card>
    </template>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { usePurchaseOrderStore } from '@/stores/purchase-order.store';
import { usePurchaseReceiptStore } from '@/stores/purchase-receipt.store';
import type { PurchaseOrder } from '@/services/purchase-order.service';
import type { PurchaseReceipt, ParsedNfe } from '@/services/purchase-receipt.service';
import AppLayout from '@/components/common/AppLayout.vue';
import Card from '@/components/common/Card.vue';
import FormField from '@/components/common/FormField.vue';
import Button from '@/components/common/Button.vue';
import StatusBadge, { type BadgeTone } from '@/components/common/StatusBadge.vue';
import { generatePDF, formatDate as formatDatePDF } from '@/utils/pdf-generator';
import { useToast } from '@/composables/useToast';

const orderStore = usePurchaseOrderStore();
const receiptStore = usePurchaseReceiptStore();
const toast = useToast();

const loadingOrders = ref(false);
const availableOrders = ref<PurchaseOrder[]>([]);
const orderSearch = ref('');
const selectedOrder = ref<PurchaseOrder | null>(null);

const receiptDate = ref(new Date().toISOString().split('T')[0]);
const invoiceNumber = ref('');
const notes = ref('');
const submitting = ref(false);
const createdReceipt = ref<PurchaseReceipt | null>(null);

const nfeFileInput = ref<HTMLInputElement | null>(null);
const parsedNfe = ref<ParsedNfe | null>(null);
const nfeMatches = ref<Record<number, string>>({}); // índice do item da NFe -> orderItemId

interface ItemRow {
  orderItemId: string;
  productId: string;
  productLabel: string;
  orderedQty: number;
  receivedQty: number;
  pending: number;
  quantityReceived: number;
  lotTracked: boolean;
  lotNumber: string;
  expiresAt: string;
  nfeQuantity: number | null;
  nfeDivergence: boolean;
}

const itemRows = ref<ItemRow[]>([]);

onMounted(loadAvailableOrders);

async function loadAvailableOrders() {
  loadingOrders.value = true;
  try {
    await orderStore.fetchOrders();
    availableOrders.value = orderStore.orders.filter(
      (o) => o.status === 'CONFIRMED' || o.status === 'PARTIAL'
    );
  } catch (e: any) {
    toast.error(e.response?.data?.message || 'Erro ao carregar pedidos');
  } finally {
    loadingOrders.value = false;
  }
}

const filteredOrders = computed(() => {
  const term = orderSearch.value.trim().toLowerCase();
  if (!term) return availableOrders.value;
  return availableOrders.value.filter(
    (o) =>
      o.orderNumber.toLowerCase().includes(term) ||
      (o.supplier?.name || '').toLowerCase().includes(term)
  );
});

const ORDER_STATUS_TONES: Record<string, BadgeTone> = {
  CONFIRMED: 'info',
  PARTIAL: 'warning',
};
const ORDER_STATUS_LABELS: Record<string, string> = {
  CONFIRMED: 'Confirmado',
  PARTIAL: 'Parcial',
};
function getOrderStatusTone(status: string): BadgeTone {
  return ORDER_STATUS_TONES[status] || 'neutral';
}
function getOrderStatusLabel(status: string): string {
  return ORDER_STATUS_LABELS[status] || status;
}

function selectOrder(order: PurchaseOrder) {
  selectedOrder.value = order;
  itemRows.value = order.items.map((item) => ({
    orderItemId: item.id,
    productId: item.productId,
    productLabel: item.product ? `${item.product.code} - ${item.product.name}` : item.productId,
    orderedQty: item.quantity,
    receivedQty: item.receivedQty,
    pending: item.quantity - item.receivedQty,
    quantityReceived: 0,
    lotTracked: item.product?.lotTracked === true,
    lotNumber: '',
    expiresAt: '',
    nfeQuantity: null,
    nfeDivergence: false,
  }));
}

const hasAnyQuantity = computed(() => itemRows.value.some((row) => row.quantityReceived > 0));

async function handleNfeFileSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  try {
    const xml = await file.text();
    parsedNfe.value = await receiptStore.parseNfe(xml);
    nfeMatches.value = {};
    toast.success('NFe lida com sucesso. Associe os itens abaixo.');
  } catch (e: any) {
    toast.error(e.response?.data?.message || 'Erro ao ler o XML da NFe');
    parsedNfe.value = null;
  } finally {
    input.value = '';
  }
}

function applyNfeMatch(nfeItemIndex: number, orderItemId: string) {
  if (!parsedNfe.value) return;
  nfeMatches.value[nfeItemIndex] = orderItemId;
  if (!orderItemId) return;

  const nfeItem = parsedNfe.value.items[nfeItemIndex];
  const row = itemRows.value.find((r) => r.orderItemId === orderItemId);
  if (!row) return;

  row.nfeQuantity = nfeItem.quantity;
  row.nfeDivergence = nfeItem.quantity > row.pending;
  row.quantityReceived = row.nfeDivergence ? row.pending : nfeItem.quantity;
  if (row.lotTracked) {
    if (nfeItem.lotNumber) row.lotNumber = nfeItem.lotNumber;
    if (nfeItem.expiresAt) row.expiresAt = nfeItem.expiresAt;
  }
}

async function handleSubmit() {
  if (!selectedOrder.value) return;

  const itemsToSend = itemRows.value
    .filter((row) => row.quantityReceived > 0)
    .map((row) => ({
      orderItemId: row.orderItemId,
      productId: row.productId,
      quantityReceived: row.quantityReceived,
      lotNumber: row.lotTracked ? row.lotNumber : undefined,
      expiresAt: row.lotTracked && row.expiresAt ? row.expiresAt : undefined,
    }));

  if (itemsToSend.length === 0) {
    toast.error('Informe a quantidade recebida de ao menos um item');
    return;
  }

  const missingLot = itemsToSend.find((item) => {
    const row = itemRows.value.find((r) => r.orderItemId === item.orderItemId);
    return row?.lotTracked && !item.lotNumber;
  });
  if (missingLot) {
    toast.error('Informe o número do lote para os itens que exigem rastreabilidade');
    return;
  }

  submitting.value = true;
  try {
    createdReceipt.value = await receiptStore.createReceipt({
      purchaseOrderId: selectedOrder.value.id,
      receiptDate: receiptDate.value,
      invoiceNumber: invoiceNumber.value || undefined,
      notes: notes.value || undefined,
      items: itemsToSend,
    });
    toast.success('Recebimento registrado com sucesso!');
  } catch (e: any) {
    toast.error(e.response?.data?.message || 'Erro ao registrar recebimento');
  } finally {
    submitting.value = false;
  }
}

function printCreatedReceipt() {
  if (!createdReceipt.value) return;
  const receipt = createdReceipt.value;
  const pdf = generatePDF({
    title: 'Comprovante de Recebimento',
    subtitle: receipt.receiptNumber,
    data: {
      Pedido: selectedOrder.value?.orderNumber || '-',
      Fornecedor: selectedOrder.value?.supplier?.name || '-',
      Data: formatDatePDF(receiptDate.value),
      Observações: notes.value || 'Nenhuma',
    },
    items: itemRows.value
      .filter((row) => row.quantityReceived > 0)
      .map((row) => ({
        produto: row.productLabel,
        quantidade: row.quantityReceived,
        lote: row.lotNumber || '-',
      })),
    itemsColumns: [
      { header: 'Produto', key: 'produto', align: 'left' },
      { header: 'Quantidade', key: 'quantidade', align: 'right' },
      { header: 'Lote', key: 'lote', align: 'left' },
    ],
    signature: { label: 'Recebido por' },
  });
  pdf.save(`Recebimento_${receipt.receiptNumber}.pdf`);
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('pt-BR');
}
</script>
```

- [ ] **Step 2: Register the route**

In `frontend/src/router/index.ts`, add right after the `/purchases/receipts` route added in Task 7:

```ts
  {
    path: '/purchases/receipts/new',
    name: 'purchase-receipt-new',
    component: () => import('../views/purchases/PurchaseReceiptFormView.vue'),
    meta: { requiresAuth: true }
  },
```

- [ ] **Step 3: Type-check**

Run: `cd frontend && npm run type-check 2>&1 | grep -c "error TS"`
Expected: same baseline, zero new errors in `PurchaseReceiptFormView.vue`. This is by far the largest new file in the plan — if new errors appear, read them individually; do not silence with `any` beyond what's already used elsewhere in this codebase's equivalent forms (`CountingPlanForm.vue` uses `ref<any[]>` for its product list, matching precedent).

- [ ] **Step 4: Manual end-to-end verification**

This is the first point where the whole feature can be verified together:
1. `docker compose ps` from `D:\Fabric` — confirm `fabric-backend`/`fabric-frontend`/`fabric-mysql` are Up; `docker compose restart frontend` if a screenshot looks stale.
2. Create a real Purchase Order via `/purchases/orders` (or use an existing CONFIRMED one from seed data) so there's something to receive.
3. Open `/purchases/receipts/new`, search for and select that order, confirm the item rows show the right Pendente quantities.
4. Fill in a partial quantity for one item (less than pending), submit, confirm success screen + "Imprimir Comprovante" produces a correct PDF with "Recebido por:" at the bottom.
5. Go back to `/purchases/receipts`, confirm the new receipt appears in the list with the order's status now `PARTIAL` (open the order in `/purchases/orders` to double check `receivedQty` incremented and status changed).
6. Repeat the receiving flow on the SAME order for the remaining pending quantity, confirm the order status becomes `RECEIVED` and it no longer appears in the "select order" list on a fresh `/purchases/receipts/new`.
7. Test the NFe import: save the `VALID_NFE_XML` string from Task 1's test file to a local `.xml` file, upload it via the file input, confirm the reconciliation UI appears, associate an item, confirm the quantity/lot pre-fill, submit.
8. Test the divergence warning: craft (or reuse/modify the same test XML with) a quantity larger than an item's pending amount, confirm the orange divergence badge appears and the quantity field is capped rather than silently over-filled.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/purchases/PurchaseReceiptFormView.vue frontend/src/router/index.ts
git commit -m "feat(frontend): tela de novo Recebimento (pedido, itens, NFe, recebimento parcial)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Final check (after all 8 tasks)

- [ ] Run `cd frontend && npm run type-check 2>&1 | grep -c "error TS"` one last time — must equal the baseline captured in Task 3 Step 1.
- [ ] Run `cd frontend && npm test -- --run` — must still be 48/48 passing (this plan doesn't touch any of the 5 tested `common/` components).
- [ ] Run `docker compose exec backend npm test` — full backend suite green.
- [ ] Screenshot `/stock` (with the new print button visible), `/purchases/receipts`, and `/purchases/receipts/new` for the project's screenshot record, following the existing convention in `docs/fase-2026-09-modernizacao/screenshots/`. In `frontend/scripts/screenshot.mjs`, add two entries to the `ROUTES` object (alphabetically near the existing `purchase-orders`/`purchase-quotations` entries):
  ```js
  'purchase-receipts': '/purchases/receipts',
  'purchase-receipts-new': '/purchases/receipts/new',
  ```
  Then run `node scripts/screenshot.mjs purchase-receipts purchase-receipts-new` (plus re-run `stock` for the updated print button) from `frontend/`.
- [ ] **Known pre-existing issue, not fixed by this plan (carried over from `WMS_IMPLEMENTATION_ANALYSIS.md` item F4.7, flagged there as a risk to remember):** `PurchaseReceipt.receiptNumber` is generated with `purchaseReceipt.count() + 1` (`purchase-receipt.service.ts`), which is not atomic under concurrent receipt creation and can reuse numbers after a cancellation. This plan's new screen makes `receiptNumber` visible on-screen and on the printed comprovante for the first time, so the pre-existing defect becomes user-facing sooner than before — still not this plan's job to fix (would mean adopting the atomic `document-sequence.service.ts` pattern already used elsewhere, a separate, focused change), but worth a follow-up ticket rather than being forgotten again.
- [ ] Follow the project's established branch → verify → merge → push cycle (see project memory `fabric-dispatch-verify-methodology`): this whole plan can be one branch (e.g. `feature-impressao-movimentacao-recebimento`) merged to `main` once all 8 tasks are done and verified, or one branch per task if preferred — decide with the user before starting execution.
