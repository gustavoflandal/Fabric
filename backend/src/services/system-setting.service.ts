import { SettingType } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { coerceSettingValue } from '../utils/setting-type.util';

export interface SystemSettingDto {
  key: string;
  value: string;
  type: SettingType;
  category: string;
  label: string;
  description: string | null;
  updatedAt: Date;
}

/**
 * Chaves cujo valor precisa vir de uma lista fechada, além de bater com o
 * `type` (STRING). `coerceSettingValue` não sabe disso — é genérico por
 * type, não por key — então a checagem fica aqui, no único lugar que grava.
 * Única chave da v1 com esse requisito: `audit.mode`, que o
 * `auditMiddleware` (Task 6) só sabe interpretar nesses 4 valores.
 */
const KEY_ENUM_VALUES: Record<string, readonly string[]> = {
  'audit.mode': ['all', 'write_only', 'errors_only', 'none'],
};

/**
 * Cache em memória dos valores JÁ CONVERTIDOS (não a string crua) — mesmo
 * padrão de `licensed-module.service.ts` (cache/loading module-level,
 * chamadas concorrentes compartilham a mesma promise de carregamento).
 * Diferença: aqui a invalidação é ATIVA (updateSetting limpa o cache na
 * hora), enquanto licensed-module só invalida sob chamada manual
 * (reloadLicensedModules) — licença de instalação praticamente nunca muda em
 * runtime; configuração do sistema muda pela tela o tempo todo.
 */
let cache: Map<string, unknown> | null = null;
let loading: Promise<Map<string, unknown>> | null = null;

const load = async (): Promise<Map<string, unknown>> => {
  const rows = await prisma.systemSetting.findMany();
  const loaded = new Map<string, unknown>();
  for (const row of rows) {
    loaded.set(row.key, coerceSettingValue(row.type, row.value));
  }
  cache = loaded;
  return loaded;
};

const loadCache = async (): Promise<Map<string, unknown>> => {
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

/** Só para testes: zera o cache sem tocar no banco. */
export const clearSettingCache = (): void => {
  cache = null;
  loading = null;
};

/**
 * Lê uma configuração. Prioridade: linha no banco (convertida pelo `type`) →
 * `fallback` (o valor hoje hardcoded/`.env` no call site) quando a chave não
 * existe — comportamento atual preservado até alguém editar pela tela.
 */
export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const settings = await loadCache();
  if (settings.has(key)) {
    return settings.get(key) as T;
  }
  return fallback;
}

/** Todas as configurações, ordenadas por categoria e depois por chave — a tela agrupa por `category` ao renderizar. */
export async function listSettings(): Promise<SystemSettingDto[]> {
  const rows = await prisma.systemSetting.findMany({
    orderBy: [{ category: 'asc' }, { key: 'asc' }],
  });
  return rows.map((row) => ({
    key: row.key,
    value: row.value,
    type: row.type,
    category: row.category,
    label: row.label,
    description: row.description,
    updatedAt: row.updatedAt,
  }));
}

/**
 * Atualiza uma configuração existente. Valida `value` contra o `type` da
 * linha ANTES de gravar (`coerceSettingValue` lança AppError 400 se
 * incompatível — nada é escrito no banco nesse caso). Invalida o cache
 * imediatamente após gravar, para a próxima leitura já refletir o novo valor.
 */
export async function updateSetting(
  key: string,
  value: string,
  updatedBy: string | undefined
): Promise<SystemSettingDto> {
  const existing = await prisma.systemSetting.findUnique({ where: { key } });
  if (!existing) {
    throw new AppError(404, `Configuração "${key}" não encontrada.`);
  }

  coerceSettingValue(existing.type, value);

  const allowedValues = KEY_ENUM_VALUES[key];
  if (allowedValues && !allowedValues.includes(value)) {
    throw new AppError(
      400,
      `Valor "${value}" inválido para "${key}". Valores aceitos: ${allowedValues.join(', ')}.`
    );
  }

  const updated = await prisma.systemSetting.update({
    where: { key },
    data: { value, updatedBy },
  });

  clearSettingCache();

  return {
    key: updated.key,
    value: updated.value,
    type: updated.type,
    category: updated.category,
    label: updated.label,
    description: updated.description,
    updatedAt: updated.updatedAt,
  };
}
