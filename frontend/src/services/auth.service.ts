import { apiClient } from './api.client';

export interface User {
  id: string;
  username: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export const authService = {
  async login(username: string, password: string): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>('/api/auth/login', {
      username,
      password,
    });

    if (response.data.token) {
      localStorage.setItem('harness_token', response.data.token);
      localStorage.setItem('harness_user', JSON.stringify(response.data.user));
    }

    return response.data;
  },

  logout(): void {
    localStorage.removeItem('harness_token');
    localStorage.removeItem('harness_user');
    window.location.href = '/login';
  },

  getCurrentUser(): User | null {
    const userStr = localStorage.getItem('harness_user');
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },

  isAuthenticated(): boolean {
    return Boolean(localStorage.getItem('harness_token'));
  },
};
