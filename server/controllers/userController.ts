import { Request, Response } from 'express';
import { pool } from "../db";

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

    const { full_name, email, phone, user_type, city_id, state } = req.body;

    const result = await pool.query(
      'INSERT INTO app_users (full_name, email, phone, user_type, city_id, state) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [full_name, email, phone, user_type, city_id, state]
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
    const { full_name, email, phone, user_type, city_id, state, status } = req.body;

    const result = await pool.query(
      `UPDATE app_users 
         SET full_name = COALESCE($1, full_name), 
             email = COALESCE($2, email), 
             phone = COALESCE($3, phone), 
             user_type = COALESCE($4, user_type), 
             city_id = COALESCE($5, city_id), 
             state = COALESCE($6, state),
             status = COALESCE($7, status)
         WHERE id = $8 
         RETURNING *`,
      [full_name, email, phone, user_type, city_id, state, status, id]
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
