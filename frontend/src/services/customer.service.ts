import api from './api.service';

export interface Customer {
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
  country: string;
  paymentTerms?: string;
  creditLimit?: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomerDto {
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
  paymentTerms?: string;
  creditLimit?: number;
  active?: boolean;
}

export interface UpdateCustomerDto extends Partial<CreateCustomerDto> {}

class CustomerService {
  private readonly basePath = '/customers';

  async getAll(page = 1, limit = 100, filters?: { active?: boolean; search?: string }) {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    if (filters?.active !== undefined) params.append('active', filters.active.toString());
    if (filters?.search) params.append('search', filters.search);
    return api.get(`${this.basePath}?${params.toString()}`);
  }

  async getById(id: string) {
    return api.get(`${this.basePath}/${id}`);
  }

  async create(data: CreateCustomerDto) {
    return api.post(this.basePath, data);
  }

  async update(id: string, data: UpdateCustomerDto) {
    return api.put(`${this.basePath}/${id}`, data);
  }

  async delete(id: string) {
    return api.delete(`${this.basePath}/${id}`);
  }

  async toggleActive(id: string) {
    return api.patch(`${this.basePath}/${id}/toggle-active`);
  }
}

export default new CustomerService();
