import { prisma } from '../config/database';
import { logger } from '../config/logger';

/**
 * F0.8 do plano do WMS, implementando a seção 3.1 de
 * docs/fase-2026-09-modernizacao/04_ARQUITETURA_MODULAR_LICENCIAMENTO.md.
 *
 * O modelo de deploy é UMA INSTALAÇÃO POR CLIENTE (não é SaaS multi-tenant
 * compartilhado). Licenciar um módulo é, portanto, configuração de instalação —
 * um valor que praticamente nunca muda em runtime, não um filtro por request.
 * Por isso a tabela `licensed_modules` é lida uma vez (no boot, ou na primeira
 * requisição que precisar dela) e mantida em um cache em memória.
 *
 * A invalidação é deliberadamente simples (`reloadLicensedModules()`, chamada
 * manualmente após um seed/script de onboarding trocar a licença): não há
 * requisito de propagar mudança de licença em tempo real sob carga, e um
 * mecanismo de invalidação distribuída seria complexidade sem caso de uso.
 */

// Códigos de módulo conhecidos. `PCP` é o NÚCLEO: está sempre habilitado e
// nenhuma rota recebe requireModule('PCP') — checá-lo seria custo por
// requisição sem benefício, e criaria o risco de derrubar o sistema inteiro por
// um erro de configuração.
export const MODULE_CODES = ['PCP', 'COMPRAS', 'WMS', 'YMS'] as const;
export type ModuleCode = (typeof MODULE_CODES)[number];

export const CORE_MODULE: ModuleCode = 'PCP';

let cache: Map<string, boolean> | null = null;
let loading: Promise<Map<string, boolean>> | null = null;

const load = async (): Promise<Map<string, boolean>> => {
  const modules = await prisma.licensedModule.findMany({
    select: { code: true, enabled: true },
  });

  const loaded = new Map<string, boolean>(
    modules.map((m) => [m.code.toUpperCase(), m.enabled])
  );

  // O núcleo nunca depende da tabela: se a linha do PCP não existir (banco
  // recém-criado, seed ainda não rodado), o sistema continua funcionando.
  if (!loaded.has(CORE_MODULE)) {
    loaded.set(CORE_MODULE, true);
  }

  cache = loaded;
  return loaded;
};

/**
 * Carrega o cache de módulos licenciados. Chamado no boot (server.ts) e,
 * como rede de segurança, na primeira consulta que encontrar o cache vazio
 * (ex.: em testes, que sobem o app sem passar pelo server.ts).
 *
 * Chamadas concorrentes compartilham a mesma promise para não disparar N
 * queries idênticas em uma rajada de requisições no primeiro segundo do boot.
 */
export const loadLicensedModules = async (): Promise<Map<string, boolean>> => {
  if (cache) {
    return cache;
  }

  if (!loading) {
    loading = load().finally(() => {
      loading = null;
    });
  }

  return loading;
};

/** Descarta o cache e relê a tabela. Use após alterar a licença da instalação. */
export const reloadLicensedModules = async (): Promise<Map<string, boolean>> => {
  cache = null;
  loading = null;
  const loaded = await loadLicensedModules();
  logger.info(
    `Módulos licenciados recarregados: ${[...loaded.entries()]
      .map(([code, enabled]) => `${code}=${enabled ? 'on' : 'off'}`)
      .join(', ')}`
  );
  return loaded;
};

/** Só para testes: zera o cache sem tocar no banco. */
export const clearLicensedModuleCache = (): void => {
  cache = null;
  loading = null;
};

/**
 * A instalação tem este módulo licenciado?
 * Módulo ausente da tabela conta como NÃO licenciado (fail-closed) — a única
 * exceção é o núcleo (PCP), tratado em `load()`.
 */
export const isModuleEnabled = async (code: string): Promise<boolean> => {
  const modules = await loadLicensedModules();
  return modules.get(code.toUpperCase()) === true;
};

/**
 * Lista de módulos da instalação, para o frontend montar menu e guard de rota.
 * Sempre devolve todos os códigos conhecidos, mesmo os que não têm linha na
 * tabela (nesse caso, `enabled: false`) — assim o cliente não precisa
 * diferenciar "não licenciado" de "não configurado".
 */
export const listLicensedModules = async (): Promise<
  { code: string; enabled: boolean }[]
> => {
  const modules = await loadLicensedModules();

  const known = MODULE_CODES.map((code) => ({
    code,
    enabled: modules.get(code) === true,
  }));

  // Códigos gravados na tabela que ainda não estão em MODULE_CODES (ex.: um
  // módulo novo seedado antes desta constante ser atualizada) também aparecem.
  const extras = [...modules.entries()]
    .filter(([code]) => !MODULE_CODES.includes(code as ModuleCode))
    .map(([code, enabled]) => ({ code, enabled }));

  return [...known, ...extras];
};
