/**
 * Utilitários de validação
 */

/**
 * Parseia um inteiro positivo com validação
 * @param value Valor a ser parseado
 * @param defaultValue Valor padrão se inválido
 * @param max Valor máximo permitido (opcional)
 * @returns Número válido ou valor padrão
 */
export function parsePositiveInt(value: any, defaultValue: number, max?: number): number {
  const parsed = parseInt(value);
  
  if (isNaN(parsed) || parsed < 1) {
    return defaultValue;
  }
  
  if (max && parsed > max) {
    return max;
  }
  
  return parsed;
}

/**
 * Parseia um número decimal positivo com validação
 * @param value Valor a ser parseado
 * @param defaultValue Valor padrão se inválido
 * @param max Valor máximo permitido (opcional)
 * @returns Número válido ou valor padrão
 */
export function parsePositiveFloat(value: any, defaultValue: number, max?: number): number {
  const parsed = parseFloat(value);
  
  if (isNaN(parsed) || parsed < 0) {
    return defaultValue;
  }
  
  if (max && parsed > max) {
    return max;
  }
  
  return parsed;
}

/**
 * Valida e parseia JSON com tratamento de erro
 * @param value String JSON a ser parseada
 * @param errorMessage Mensagem de erro customizada
 * @returns Objeto parseado
 */
export function parseJsonSafely<T = any>(value: string, errorMessage?: string): T {
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    throw new Error(errorMessage || 'JSON inválido ou malformado');
  }
}

/**
 * Valida array de strings
 * @param value Array a ser validado
 * @param errorMessage Mensagem de erro customizada
 * @returns true se válido
 */
export function validateStringArray(value: any, errorMessage?: string): value is string[] {
  if (!Array.isArray(value)) {
    throw new Error(errorMessage || 'Deve ser um array');
  }
  
  if (!value.every(item => typeof item === 'string' && item.length > 0)) {
    throw new Error(errorMessage || 'Array deve conter apenas strings não vazias');
  }
  
  return true;
}

/**
 * Valida se uma data é válida e futura
 * @param date Data a ser validada
 * @param allowPast Permite datas no passado
 * @returns true se válido
 */
export function validateDate(date: Date, allowPast = false): boolean {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return false;
  }
  
  if (!allowPast) {
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    if (date < oneDayAgo) {
      return false;
    }
  }
  
  return true;
}

/**
 * Valida período de datas (início < fim)
 * @param startDate Data de início
 * @param endDate Data de fim
 * @returns true se válido
 */
export function validateDateRange(startDate: Date, endDate: Date): boolean {
  if (!validateDate(startDate, true) || !validateDate(endDate, true)) {
    return false;
  }
  
  return endDate > startDate;
}
