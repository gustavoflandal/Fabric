/**
 * Tipos do domínio de armazenagem (armazéns, estruturas e posições).
 *
 * Extraídos a partir do uso real nas views/services — este módulo não introduz
 * campos novos, apenas dá nome ao formato que o código já assume em runtime.
 */

/** Envelope padrão das respostas da API (`{ data, pagination, message }`). */
export interface ApiEnvelope<T> {
  data: T;
  pagination?: Pagination;
  message?: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

/** Erro de requisição (axios) na forma consumida pelos `catch` das views. */
export interface ApiError {
  response?: {
    data?: {
      message?: string;
    };
  };
}

/* -------------------------------------------------------------------------- */
/* Armazém                                                                     */
/* -------------------------------------------------------------------------- */

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  legalName?: string;
  document?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  managerName?: string;
  capacity?: number;
  description?: string;
  active: boolean;
}

/** Modelo do formulário de armazém (campos ainda não persistidos). */
export type WarehouseFormData = Omit<Warehouse, 'id'>;

export interface WarehouseFilters {
  search?: string;
}

/* -------------------------------------------------------------------------- */
/* Estrutura de armazenagem (rua)                                              */
/* -------------------------------------------------------------------------- */

export interface WarehouseStructure {
  id: string;
  streetCode: string;
  warehouseId: string;
  /** Armazém associado, quando a API expande o relacionamento. */
  warehouse?: Pick<Warehouse, 'id' | 'code' | 'name'>;
  floors: number;
  positions: number;
  weightCapacity?: number;
  height?: number;
  width?: number;
  depth?: number;
  maxHeight?: number;
  positionType?: string;
  blocked: boolean;
  /** Quantas posições já foram geradas para esta estrutura. */
  generatedPositionsCount?: number;
}

/**
 * Modelo do formulário de estrutura.
 *
 * Os campos numéricos aceitam `string` porque vêm de `<input>` e só são
 * convertidos com `Number()` no submit — comportamento preexistente, preservado.
 */
export interface WarehouseStructureFormData {
  streetCode: string;
  warehouseId: string;
  floors: number | string;
  positions: number | string;
  weightCapacity: number | string;
  height: number | string;
  width: number | string;
  depth: number | string;
  maxHeight: number | string;
  positionType: string;
  blocked: boolean;
}

export interface WarehouseStructureFilters {
  search?: string;
  blocked?: boolean | string;
}

/* -------------------------------------------------------------------------- */
/* Posição de armazenagem                                                      */
/* -------------------------------------------------------------------------- */

export interface StoragePosition {
  id: string;
  code: string;
  structureId?: string;
  floor: number;
  position: number;
  blocked: boolean;
}
