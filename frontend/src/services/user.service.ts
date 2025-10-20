import api from './api.service';

export interface User {
  id: string;
  name: string;
  email: string;
  active: boolean;
  lastLogin: string | null;
  createdAt: string;
  roles: Role[];
}

export interface Role {
  id: string;
  code: string;
  name: string;
  description?: string;
}

export interface CreateUserDto {
  name: string;
  email: string;
  password: string;
  roleIds?: string[];
}

export interface UpdateUserDto {
  name?: string;
  email?: string;
  active?: boolean;
}

class UserService {
  async getAll(page = 1, limit = 50, search?: string) {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    
    if (search) {
      params.append('search', search);
    }

    const response = await api.get(`/users?${params.toString()}`);
    return response.data;
  }

  async getById(id: string) {
    const response = await api.get(`/users/${id}`);
    return response.data;
  }

  async create(data: CreateUserDto) {
    const response = await api.post('/users', data);
    return response.data;
  }

  async update(id: string, data: UpdateUserDto) {
    const response = await api.put(`/users/${id}`, data);
    return response.data;
  }

  async delete(id: string) {
    const response = await api.delete(`/users/${id}`);
    return response.data;
  }

  async changePassword(currentPassword: string, newPassword: string) {
    const response = await api.put('/users/me/password', {
      currentPassword,
      newPassword,
    });
    return response.data;
  }

  async assignRoles(userId: string, roleIds: string[]) {
    const response = await api.post(`/users/${userId}/roles`, { roleIds });
    return response.data;
  }
}

export default new UserService();
