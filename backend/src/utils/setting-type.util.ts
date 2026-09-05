import { SettingType } from '@prisma/client';
import { AppError } from '../middleware/error.middleware';

/**
 * Converte/valida o `value` (sempre String no banco, ver SystemSetting) de
 * acordo com o `type` declarado na linha. Usada tanto na LEITURA
 * (system-setting.service.ts::getSetting, para devolver o tipo certo ao
 * chamador) quanto na ESCRITA (updateSetting, para recusar um valor
 * incompatível antes de gravar) — uma função só, para as duas pontas nunca
 * divergirem sobre o que é um valor válido para cada tipo.
 */
export function coerceSettingValue(type: SettingType, raw: string): string | number | boolean | unknown {
  switch (type) {
    case 'STRING':
      return raw;

    case 'NUMBER': {
      const parsed = Number(raw);
      if (raw.trim() === '' || !Number.isFinite(parsed)) {
        throw new AppError(400, `Valor "${raw}" não é um número válido.`);
      }
      return parsed;
    }

    case 'BOOLEAN': {
      if (raw !== 'true' && raw !== 'false') {
        throw new AppError(400, `Valor "${raw}" não é um booleano válido (use "true" ou "false").`);
      }
      return raw === 'true';
    }

    case 'JSON': {
      try {
        return JSON.parse(raw);
      } catch {
        throw new AppError(400, `Valor "${raw}" não é um JSON válido.`);
      }
    }

    default: {
      const exhaustive: never = type;
      throw new AppError(500, `Tipo de configuração desconhecido: ${exhaustive}`);
    }
  }
}
