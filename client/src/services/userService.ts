const API_URL = '/api';

export interface User {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  user_type: 'passenger' | 'driver';
  city_id: number;
  state: string;
  status: string;
  created_at: string;
}

export const userService = {
  getUsers: async (): Promise<User[]> => {
    const response = await fetch(`${API_URL}/users`);
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    return response.json();
  },

  createUser: async (user: Omit<User, 'id' | 'created_at' | 'status'>): Promise<User> => {
    const response = await fetch(`${API_URL}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
    });
    if (!response.ok) {
      throw new Error('Failed to delete user');
    }
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

