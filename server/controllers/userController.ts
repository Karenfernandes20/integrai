import { Request, Response } from 'express';
import { pool } from "../db";
import bcrypt from 'bcryptjs';

export const getUsers = async (req: Request, res: Response) => {
  try {
    if (!pool) return res.status(500).json({ error: 'Database not configured' });

    let result;
    const user = (req as any).user;
    if (user?.role === 'SUPERADMIN') {
      result = await pool.query('SELECT * FROM app_users ORDER BY created_at DESC');
    } else {
      result = await pool.query('SELECT * FROM app_users WHERE company_id = $1 ORDER BY created_at DESC', [user?.company_id]);
    }
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

export const createUser = async (req: Request, res: Response) => {
  try {
    if (!pool) return res.status(500).json({ error: 'Database not configured' });

    let { full_name, email, phone, user_type, city_id, state, company_id, password, role, permissions, city } = req.body;

    // If not superadmin, force company_id to be the same as the creator
    const creator = (req as any).user;
    if (creator?.role !== 'SUPERADMIN') {
      company_id = creator?.company_id;
    }

    // Resolve City ID if name provided
    if (city && !city_id) {
      try {
        let query = 'SELECT id FROM cities WHERE lower(name) = lower($1)';
        const params: any[] = [city];
        if (state) {
          query += ' AND state = $2';
          params.push(state);
        }
        query += ' LIMIT 1';

        const cityCheck = await pool.query(query, params);
        if (cityCheck.rows.length > 0) {
          city_id = cityCheck.rows[0].id;
        } else if (state) {
          // Create new city if state is available
          const newCity = await pool.query(
            'INSERT INTO cities (name, state) VALUES ($1, $2) RETURNING id',
            [city, state]
          );
          city_id = newCity.rows[0].id;
        }
      } catch (cityErr) {
        console.error("Error resolving city:", cityErr);
        // non-blocking, just leaves city_id null
      }
    }

    // Optional: hash password if provided, otherwise default '123456'
    let hash = null;
    const passToHash = password || '123456';
    const salt = await bcrypt.genSalt(10);
    hash = await bcrypt.hash(passToHash, salt);

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

    // Use transaction for safety
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Unlink or Delete Dependencies
      // Set user_id to NULL for messages sent by this user (preserve history)
      await client.query('UPDATE whatsapp_messages SET user_id = NULL WHERE user_id = $1', [id]);

      // Set user_id to NULL for conversations assigned to this user
      await client.query('UPDATE whatsapp_conversations SET user_id = NULL WHERE user_id = $1', [id]);

      // Set user_id to NULL for campaigns created by this user
      await client.query('UPDATE whatsapp_campaigns SET user_id = NULL WHERE user_id = $1', [id]);

      // Unlink Audit Logs
      await client.query('UPDATE whatsapp_audit_logs SET user_id = NULL WHERE user_id = $1', [id]);

      // Unlink Rides (Passenger or Driver)
      await client.query('UPDATE rides SET passenger_id = NULL WHERE passenger_id = $1', [id]);
      await client.query('UPDATE rides SET driver_id = NULL WHERE driver_id = $1', [id]);

      // Unlink Follow Ups
      await client.query('UPDATE crm_follow_ups SET user_id = NULL WHERE user_id = $1', [id]);

      // 2. Delete the user
      const result = await client.query('DELETE FROM app_users WHERE id = $1 RETURNING *', [id]);

      await client.query('COMMIT');

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ message: 'User deleted successfully' });
    } catch (e: any) {
      await client.query('ROLLBACK');
      console.error(`[Delete User ${id}] Failed:`, e);
      res.status(500).json({ error: 'Failed to delete user due to dependencies', details: e.message });
    } finally {
      client.release();
    }
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

export const updateProfile = async (req: Request, res: Response) => {
  try {
    if (!pool) return res.status(500).json({ error: 'Database not configured' });

    const id = (req as any).user?.id;
    if (!id) return res.status(401).json({ error: 'Unauthorized' });

    const { full_name, email, phone, password } = req.body;

    let password_hash = null;
    if (password) {
      const salt = await bcrypt.genSalt(10);
      password_hash = await bcrypt.hash(password, salt);
    }

    const result = await pool.query(
      `UPDATE app_users 
          SET full_name = COALESCE($1, full_name), 
              email = COALESCE($2, email), 
              phone = COALESCE($3, phone),
              password_hash = COALESCE($4, password_hash)
          WHERE id = $5
          RETURNING id, full_name, email, phone, role, company_id, user_type`,
      [full_name, email, phone, password_hash, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile', details: error.message });
  }
};
