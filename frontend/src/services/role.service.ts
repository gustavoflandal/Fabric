import api from './api.service';

export interface Role {
  id: string;
  code: string;
  name: string;
  description?: string;
  active: boolean;
  permissions: Permission[];
  usersCount?: number;
}

export interface Permission {
  id: string;
  resource: string;
  action: string;
  description?: string;
}

export interface CreateRoleDto {
  code: string;
  name: string;
  description?: string;
  permissionIds?: string[];
}

export interface UpdateRoleDto {
  code?: string;
  name?: string;
  description?: string;
  active?: boolean;
}

class RoleService {
  async getAll() {
    const response = await api.get('/roles');
    return response.data;
  }

  async getById(id: string) {
    const response = await api.get(`/roles/${id}`);
    return response.data;
  }

  async create(data: CreateRoleDto) {
    const response = await api.post('/roles', data);
    return response.data;
  }

  async update(id: string, data: UpdateRoleDto) {
    const response = await api.put(`/roles/${id}`, data);
    return response.data;
  }

  async delete(id: string) {
    const response = await api.delete(`/roles/${id}`);
    return response.data;
  }

  async assignPermissions(roleId: string, permissionIds: string[]) {
    const response = await api.post(`/roles/${roleId}/permissions`, { permissionIds });
    return response.data;
  }

  async getAllPermissions() {
    const response = await api.get('/permissions');
    return response.data;
  }
}

export default new RoleService();
