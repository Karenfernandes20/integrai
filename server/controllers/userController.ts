import { Request, Response } from 'express';
import { pool } from "../db";
import bcrypt from 'bcryptjs';

export const getUsers = async (req: Request, res: Response) => {
  try {
    if (!pool) return res.status(500).json({ error: 'Database not configured' });

    const result = await pool.query('SELECT * FROM app_users ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

export const createUser = async (req: Request, res: Response) => {
  try {
    if (!pool) return res.status(500).json({ error: 'Database not configured' });

    const { full_name, email, phone, user_type, city_id, state, company_id, password, role, permissions } = req.body;

    // Optional: hash password if provided, otherwise default
    let hash = null;
    if (password) {
      const salt = await bcrypt.genSalt(10);
      hash = await bcrypt.hash(password, salt);
    }

    const result = await pool.query(
      'INSERT INTO app_users (full_name, email, phone, user_type, city_id, state, company_id, password_hash, role, permissions) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
      [full_name, email, phone, user_type, city_id, state, company_id, hash, role || 'USUARIO', JSON.stringify(permissions || [])]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
};

export const updateUser = async (req: Request, res: Response) => {
  try {
    if (!pool) return res.status(500).json({ error: 'Database not configured' });

    const { id } = req.params;
    const { full_name, email, phone, user_type, city_id, state, role, is_active, permissions } = req.body;

    const result = await pool.query(
      `UPDATE app_users 
         SET full_name = COALESCE($1, full_name), 
             email = COALESCE($2, email), 
             phone = COALESCE($3, phone), 
             user_type = COALESCE($4, user_type), 
             city_id = COALESCE($5, city_id), 
             state = COALESCE($6, state),
             role = COALESCE($7, role),
             is_active = COALESCE($8, is_active),
             permissions = COALESCE($9, permissions)
         WHERE id = $10
         RETURNING *`,
      [full_name, email, phone, user_type, city_id, state, role, is_active, permissions ? JSON.stringify(permissions) : null, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    if (!pool) return res.status(500).json({ error: 'Database not configured' });

    const { id } = req.params;

    const result = await pool.query('DELETE FROM app_users WHERE id = $1 RETURNING *', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
};

export const clearUsers = async (_req: Request, res: Response) => {
  try {
    if (!pool) return res.status(500).json({ error: 'Database not configured' });

    await pool.query('DELETE FROM app_users');
    res.json({ message: 'All users deleted successfully' });
  } catch (error) {
    console.error('Error clearing users:', error);
    res.status(500).json({ error: 'Failed to clear users' });
  }
};

export const resetUserPassword = async (req: Request, res: Response) => {
  try {
    if (!pool) return res.status(500).json({ error: 'Database not configured' });
    const { id } = req.params;
    const { password } = req.body;

    if (!password) return res.status(400).json({ error: 'Password required' });

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    const result = await pool.query(
      'UPDATE app_users SET password_hash = $1 WHERE id = $2 RETURNING id, email',
      [hash, id]
    );

    if (result.rowCount === 0) return res.status(404).json({ error: 'User not found' });

    res.json({ message: 'Password reset successfully', user: result.rows[0] });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
};
