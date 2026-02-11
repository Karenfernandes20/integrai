import { Request, Response } from 'express';
import { pool } from "../db";
import bcrypt from 'bcryptjs';
import { logAudit } from '../auditLogger';
import { checkLimit } from '../services/limitService';
import { ROLES, DEFAULT_ROLE_PERMISSIONS } from '../config/roles';

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

    // Limit Check
    if (company_id) {
      // If user is adding user to their own company or superadmin adding to another
      const allowed = await checkLimit(company_id, 'users');
      if (!allowed) {
        return res.status(403).json({ error: `Limite de usuários atingido para este plano. (Status: ${allowed}, CoId: ${company_id})` });
      }
    }

    // Optional: hash password if provided, otherwise default '123456'
    let hash = null;
    const passToHash = password || '123456';
    const salt = await bcrypt.genSalt(10);
    hash = await bcrypt.hash(passToHash, salt);

    // Default Role
    const assignedRole = role || ROLES.USER;
    const assignedPermissions = permissions || DEFAULT_ROLE_PERMISSIONS[assignedRole as keyof typeof DEFAULT_ROLE_PERMISSIONS] || [];

    const result = await pool.query(
      'INSERT INTO app_users (full_name, email, phone, user_type, city_id, state, company_id, password_hash, role, permissions) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
      [full_name, email, phone, user_type, city_id, state, company_id, hash, assignedRole, JSON.stringify(assignedPermissions)]
    );

    const newUser = result.rows[0];

    // Audit Log
    await logAudit({
      userId: creator.id,
      companyId: creator.company_id,
      action: 'create',
      resourceType: 'user',
      resourceId: newUser.id,
      newValues: newUser,
      details: `Criou usuário: ${newUser.full_name} (${newUser.email})`
    });

    res.status(201).json(newUser);
  } catch (error: any) {
    console.error('Error creating user:', error);
    // Return specific constraint errors (like unique email)
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Este email já está cadastrado no sistema.' });
    }
    res.status(500).json({ error: 'Failed to create user', details: error.message });
  }
};

export const updateUser = async (req: Request, res: Response) => {
  try {
    if (!pool) return res.status(500).json({ error: 'Database not configured' });

    const { id } = req.params;
    const { full_name, email, phone, user_type, city_id, state, role, is_active, permissions } = req.body;
    const modifier = (req as any).user;
    const isSuperAdmin = modifier?.role === 'SUPERADMIN';

    // Access Check
    const checkUser = await pool.query('SELECT company_id FROM app_users WHERE id = $1', [id]);
    if (checkUser.rowCount === 0) return res.status(404).json({ error: 'User not found' });

    if (!isSuperAdmin && checkUser.rows[0].company_id !== modifier.company_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

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
      [full_name, email, phone, user_type, city_id, state, role, is_active, permissions ? JSON.stringify(permissions) : (role ? JSON.stringify(DEFAULT_ROLE_PERMISSIONS[role as keyof typeof DEFAULT_ROLE_PERMISSIONS]) : null), id]
    );

    const updatedUser = result.rows[0];

    // Audit Log
    await logAudit({
      userId: modifier.id,
      companyId: modifier.company_id,
      action: 'update',
      resourceType: 'user',
      resourceId: updatedUser.id,
      newValues: updatedUser,
      details: `Atualizou usuário: ${updatedUser.full_name}`
    });

    res.json(updatedUser);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    if (!pool) return res.status(500).json({ error: 'Database not configured' });

    const { id } = req.params;
    const modifier = (req as any).user;
    const isSuperAdmin = modifier?.role === 'SUPERADMIN';

    // Access Check
    const checkUser = await pool.query('SELECT company_id FROM app_users WHERE id = $1', [id]);
    if (checkUser.rowCount === 0) return res.status(404).json({ error: 'User not found' });

    if (!isSuperAdmin && checkUser.rows[0].company_id !== modifier.company_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Use transaction for safety
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Unlink or Delete Dependencies
      // Essential/Common
      await client.query('UPDATE whatsapp_messages SET user_id = NULL WHERE user_id = $1', [id]);
      await client.query('UPDATE whatsapp_conversations SET user_id = NULL WHERE user_id = $1', [id]);
      await client.query('UPDATE whatsapp_campaigns SET user_id = NULL WHERE user_id = $1', [id]);
      await client.query('UPDATE whatsapp_audit_logs SET user_id = NULL WHERE user_id = $1', [id]);
      await client.query('UPDATE audit_logs SET user_id = NULL WHERE user_id = $1', [id]);

      // CRM & Tasks
      await client.query('UPDATE crm_follow_ups SET user_id = NULL WHERE user_id = $1', [id]);
      await client.query('UPDATE crm_appointments SET responsible_id = NULL WHERE responsible_id = $1', [id]);
      await client.query('UPDATE crm_professionals SET user_id = NULL WHERE user_id = $1', [id]);
      await client.query('UPDATE admin_tasks SET responsible_id = NULL WHERE responsible_id = $1', [id]);
      await client.query('UPDATE admin_tasks SET created_by = NULL WHERE created_by = $1', [id]);
      await client.query('UPDATE admin_task_history SET user_id = NULL WHERE user_id = $1', [id]);
      await client.query('UPDATE roadmap_items SET created_by = NULL WHERE created_by = $1', [id]);
      await client.query('UPDATE roadmap_comments SET user_id = NULL WHERE user_id = $1', [id]);
      await client.query('UPDATE faq_questions SET user_id = NULL WHERE user_id = $1', [id]);

      // System & Settings
      await client.query('UPDATE system_workflows SET created_by = NULL WHERE created_by = $1', [id]);
      await client.query('UPDATE global_templates SET created_by = NULL WHERE created_by = $1', [id]);
      await client.query('UPDATE system_settings SET updated_by = NULL WHERE updated_by = $1', [id]);
      await client.query('UPDATE legal_pages SET last_updated_by = NULL WHERE last_updated_by = $1', [id]);
      await client.query('UPDATE entity_links SET created_by = NULL WHERE created_by = $1', [id]);

      // Module Specific (Lavajato, Restaurant, Loja)
      await client.query('UPDATE lavajato_appointments SET staff_id = NULL WHERE staff_id = $1', [id]);
      await client.query('UPDATE lavajato_service_orders SET staff_id = NULL WHERE staff_id = $1', [id]);
      await client.query('UPDATE restaurant_orders SET user_id = NULL WHERE user_id = $1', [id]);
      await client.query('UPDATE restaurant_deliveries SET delivery_staff_id = NULL WHERE delivery_staff_id = $1', [id]);
      await client.query('UPDATE inventory_movements SET user_id = NULL WHERE user_id = $1', [id]);
      await client.query('UPDATE sales SET user_id = NULL WHERE user_id = $1', [id]);
      await client.query('UPDATE goals SET user_id = NULL WHERE user_id = $1', [id]);

      // 2. Delete the user
      const result = await client.query('DELETE FROM app_users WHERE id = $1 RETURNING *', [id]);

      await client.query('COMMIT');

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const deletedUser = result.rows[0];

      // Audit Log
      await logAudit({
        userId: modifier.id,
        companyId: modifier.company_id,
        action: 'delete',
        resourceType: 'user',
        resourceId: id,
        oldValues: deletedUser,
        details: `Removeu usuário: ${deletedUser.full_name} (${deletedUser.email})`
      });

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

    // Since this is nuclear, let's keep it SuperAdmin only or remove it. 
    // Wait, the routes.ts usually protects this. Assuming protected.
    // Actually, CLEAR ALL USERS is very dangerous in Multi-Tenant.
    // It should probably be disabled or scoped.
    // For now, I will leave it as is but assume routes protects it carefully.
    // Ideally it should be "Delete all users FROM COMPANY X".

    // Changing to throw error for safety until scoped
    return res.status(403).json({ error: 'Bulk delete disabled for safety' });

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
    const modifier = (req as any).user;
    const isSuperAdmin = modifier?.role === 'SUPERADMIN';

    if (!password) return res.status(400).json({ error: 'Password required' });

    // Access Check
    const checkUser = await pool.query('SELECT company_id FROM app_users WHERE id = $1', [id]);
    if (checkUser.rowCount === 0) return res.status(404).json({ error: 'User not found' });

    if (!isSuperAdmin && checkUser.rows[0].company_id !== modifier.company_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    const result = await pool.query(
      'UPDATE app_users SET password_hash = $1 WHERE id = $2 RETURNING id, email',
      [hash, id]
    );

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
    const companyId = (req as any).user?.company_id;
    if (!id) return res.status(401).json({ error: 'Unauthorized' });

    const { full_name, email, phone, password, remove_logo, theme } = req.body;
    const logoFile = req.file;

    let password_hash = null;
    if (password) {
      const salt = await bcrypt.genSalt(10);
      password_hash = await bcrypt.hash(password, salt);
    }

    // Update user profile
    const result = await pool.query(
      `UPDATE app_users 
          SET full_name = COALESCE($1, full_name), 
              email = COALESCE($2, email), 
              phone = COALESCE($3, phone),
              password_hash = COALESCE($4, password_hash),
              theme = COALESCE($6, theme)
          WHERE id = $5
          RETURNING id, full_name, email, phone, role, company_id, user_type, theme, profile_pic_url`,
      [full_name, email, phone, password_hash, id, theme]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Handle company logo update
    if (companyId && (logoFile || remove_logo === 'true')) {
      try {
        if (remove_logo === 'true') {
          // Remove logo
          await pool.query('UPDATE companies SET logo_url = NULL WHERE id = $1', [companyId]);
        } else if (logoFile) {
          // Convert to base64
          const base64Logo = logoFile.buffer.toString('base64');
          const logoDataUrl = `data:${logoFile.mimetype};base64,${base64Logo}`;

          await pool.query('UPDATE companies SET logo_url = $1 WHERE id = $2', [logoDataUrl, companyId]);
        }

        // Fetch updated company info
        const companyResult = await pool.query('SELECT logo_url FROM companies WHERE id = $1', [companyId]);
        if (companyResult.rows.length > 0) {
          (result.rows[0] as any).company = companyResult.rows[0];
        }
      } catch (logoError) {
        console.error('Error updating company logo:', logoError);
        // Continue even if logo update fails
      }
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile', details: error.message });
  }
};
