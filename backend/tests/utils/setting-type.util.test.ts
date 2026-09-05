import { coerceSettingValue } from '../../src/utils/setting-type.util';
import { AppError } from '../../src/middleware/error.middleware';

describe('coerceSettingValue', () => {
  it('STRING devolve o valor como está', () => {
    expect(coerceSettingValue('STRING', 'write_only')).toBe('write_only');
  });

  it('NUMBER converte string numérica válida', () => {
    expect(coerceSettingValue('NUMBER', '24')).toBe(24);
    expect(coerceSettingValue('NUMBER', '7.5')).toBe(7.5);
  });

  it('NUMBER rejeita valor não numérico', () => {
    expect(() => coerceSettingValue('NUMBER', 'abc')).toThrow(AppError);
    expect(() => coerceSettingValue('NUMBER', '')).toThrow(AppError);
  });

  it('BOOLEAN aceita só "true" ou "false"', () => {
    expect(coerceSettingValue('BOOLEAN', 'true')).toBe(true);
    expect(coerceSettingValue('BOOLEAN', 'false')).toBe(false);
    expect(() => coerceSettingValue('BOOLEAN', 'sim')).toThrow(AppError);
  });

  it('JSON faz parse de um objeto válido e rejeita inválido', () => {
    expect(coerceSettingValue('JSON', '{"a":1}')).toEqual({ a: 1 });
    expect(() => coerceSettingValue('JSON', '{a:1}')).toThrow(AppError);
  });
});
