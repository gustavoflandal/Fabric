#!/usr/bin/env node
/**
 * Captura screenshot de cada rota do frontend, autenticado, e salva em
 * docs/fase-2026-09-modernizacao/screenshots/ — usado como checkpoint visual
 * a cada lote de telas migradas para o padrão (05_PADRAO_FRONTEND.md).
 *
 * Pré-requisito: backend (porta 3005) e frontend (porta 5173, `npm run dev`)
 * já rodando. O script não sobe nenhum dos dois — é intencional, pra não
 * duplicar o servidor de dev que normalmente já está de pé.
 *
 * Uso:
 *   node scripts/screenshot.mjs                 # todas as rotas conhecidas
 *   node scripts/screenshot.mjs dashboard stock  # só as rotas informadas (nome do arquivo, sem extensão)
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../../docs/fase-2026-09-modernizacao/screenshots');
const BASE_URL = process.env.SCREENSHOT_BASE_URL || 'http://localhost:5173';
const LOGIN_EMAIL = process.env.SCREENSHOT_EMAIL || 'admin@fabric.com';
const LOGIN_PASSWORD = process.env.SCREENSHOT_PASSWORD || 'admin123';

// Rotas estáticas (sem parâmetro dinâmico) definidas em src/router/index.ts.
// Nome do arquivo de saída = chave. Adicione aqui conforme novas telas do
// WMS forem nascendo (guard/menu por módulo, saldo por posição, etc.).
const ROUTES = {
  dashboard: '/dashboard',
  'pcp-dashboard': '/pcp/dashboard',
  users: '/users',
  'audit-logs': '/audit-logs',
  'system-settings': '/settings/system',
  roles: '/roles',
  'units-of-measure': '/units-of-measure',
  suppliers: '/suppliers',
  customers: '/customers',
  'work-centers': '/work-centers',
  products: '/products',
  'production-orders': '/production-orders',
  'production-pointings': '/production-pointings',
  mrp: '/mrp',
  stock: '/stock',
  reports: '/reports',
  'purchase-quotations': '/purchases/quotations',
  'purchase-orders': '/purchases/orders',
  'purchase-receipts': '/purchases/receipts',
  'purchase-receipts-new': '/purchases/receipts/new',
  'wms-operations': '/wms/operations',
  'wms-workflows': '/wms/workflows',
  'wms-workflow-new': '/wms/workflows/new',
  notifications: '/notifications',
  'counting-dashboard': '/counting/dashboard',
  'counting-plans': '/counting/plans',
  'counting-plan-new': '/counting/plans/new',
  'counting-sessions': '/counting/sessions',
  warehouses: '/warehouses',
  'warehouse-structures': '/warehouse-structures',
};

async function main() {
  const requested = process.argv.slice(2);
  const routeNames = requested.length > 0 ? requested : Object.keys(ROUTES);
  const missing = routeNames.filter((name) => !ROUTES[name]);
  if (missing.length > 0) {
    console.error(`Rota(s) desconhecida(s): ${missing.join(', ')}`);
    console.error(`Conhecidas: ${Object.keys(ROUTES).join(', ')}`);
    process.exit(1);
  }

  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log(`Login em ${BASE_URL}/login ...`);
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await page.fill('#email', LOGIN_EMAIL);
  await page.fill('#password', LOGIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
  console.log('Autenticado.');

  for (const name of routeNames) {
    const url = `${BASE_URL}${ROUTES[name]}`;
    console.log(`  ${name} -> ${ROUTES[name]}`);
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
      // Dá um instante pra requisições disparadas em onMounted (não capturadas
      // pelo networkidle se houver polling/timers) renderizarem.
      await page.waitForTimeout(400);
      await page.screenshot({
        path: path.join(OUT_DIR, `${name}.png`),
        fullPage: true,
      });
    } catch (error) {
      console.error(`    falhou: ${error.message}`);
    }
  }

  await browser.close();
  console.log(`\nScreenshots salvos em ${OUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
