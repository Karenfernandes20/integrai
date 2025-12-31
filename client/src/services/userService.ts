const API_URL = '/api';

export interface User {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  user_type: 'passenger' | 'driver' | null;
  role: 'SUPERADMIN' | 'ADMIN' | 'USUARIO';
  company_id: number;
  city_id: number;
  state: string;
  is_active: boolean;
  created_at: string;
}

export const userService = {
  getUsers: async (): Promise<User[]> => {
    const response = await fetch(`${API_URL}/users`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    return response.json();
  },

  createUser: async (user: Partial<User> & { password?: string }): Promise<User> => {
    const response = await fetch(`${API_URL}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(user),
    });
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    return response.json();
  },

  deleteUser: async (id: number): Promise<void> => {
    const response = await fetch(`${API_URL}/users/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    if (!response.ok) {
      throw new Error('Failed to delete user');
    }
  },

  updateUser: async (id: number, data: Partial<User>): Promise<User> => {
    const response = await fetch(`${API_URL}/users/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update user');
    return response.json();
  },

  clearUsers: async (): Promise<void> => {
    const response = await fetch(`${API_URL}/users`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to clear users');
    }
  },
};

