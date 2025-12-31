import { Request, Response } from 'express';
import { pool } from '../db';

export const getFollowUps = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        const user = (req as any).user;
        const companyId = user?.company_id;
        const isAdmin = user.role === 'SUPERADMIN' || user.role === 'ADMIN';

        let query = `
            SELECT 
                f.*,
                l.name as lead_name,
                l.phone as lead_phone,
                s.name as stage_name,
                u.full_name as responsible_name,
                c.contact_name as whatsapp_contact_name
            FROM crm_follow_ups f
            LEFT JOIN crm_leads l ON f.lead_id = l.id
            LEFT JOIN crm_stages s ON l.stage_id = s.id
            LEFT JOIN app_users u ON f.user_id = u.id
            LEFT JOIN whatsapp_conversations c ON f.conversation_id = c.id
            WHERE f.company_id = $1
        `;
        const params: any[] = [companyId];

        if (!isAdmin) {
            query += ` AND f.user_id = $2`;
            params.push(user.id);
        }

        query += ` ORDER BY f.scheduled_at ASC`;

        const result = await pool.query(query, params);

        // Update status for overdue items in the returned array (or via DB if we want to be persistent)
        const now = new Date();
        const items = result.rows.map(item => {
            if (item.status === 'pending' && new Date(item.scheduled_at) < now) {
                return { ...item, status: 'overdue' };
            }
            return item;
        });

        res.json(items);
    } catch (error) {
        console.error('Error fetching follow-ups:', error);
        res.status(500).json({ error: 'Failed to fetch follow-ups' });
    }
};

export const createFollowUp = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        const user = (req as any).user;
        const companyId = user?.company_id;
        const { title, description, type, scheduled_at, lead_id, conversation_id, user_id, origin } = req.body;

        const result = await pool.query(
            `INSERT INTO crm_follow_ups 
            (title, description, type, scheduled_at, lead_id, conversation_id, user_id, company_id, origin) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
            RETURNING *`,
            [title, description, type, scheduled_at, lead_id, conversation_id, user_id || user.id, companyId, origin || 'Manual']
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating follow-up:', error);
        res.status(500).json({ error: 'Failed to create follow-up' });
    }
};

export const updateFollowUp = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        const { id } = req.params;
        const { title, description, type, scheduled_at, status, completed_at, user_id } = req.body;

        const result = await pool.query(
            `UPDATE crm_follow_ups SET 
                title = COALESCE($1, title),
                description = COALESCE($2, description),
                type = COALESCE($3, type),
                scheduled_at = COALESCE($4, scheduled_at),
                status = COALESCE($5, status),
                completed_at = $6,
                user_id = COALESCE($7, user_id),
                updated_at = NOW()
            WHERE id = $8 RETURNING *`,
            [title, description, type, scheduled_at, status, completed_at, user_id, id]
        );

        if (result.rowCount === 0) return res.status(404).json({ error: 'Follow-up not found' });
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating follow-up:', error);
        res.status(500).json({ error: 'Failed to update follow-up' });
    }
};

export const deleteFollowUp = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        const { id } = req.params;
        await pool.query('DELETE FROM crm_follow_ups WHERE id = $1', [id]);
        res.json({ message: 'Follow-up deleted' });
    } catch (error) {
        console.error('Error deleting follow-up:', error);
        res.status(500).json({ error: 'Failed to delete follow-up' });
    }
};

export const getFollowUpStats = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        const user = (req as any).user;
        const companyId = user?.company_id;

        const query = `
            SELECT 
                COUNT(*) FILTER (WHERE status = 'pending') as pending,
                COUNT(*) FILTER (WHERE status = 'pending' AND scheduled_at < NOW()) as overdue,
                COUNT(*) FILTER (WHERE status = 'completed' AND completed_at >= CURRENT_DATE) as completed_today,
                COUNT(*) as total
            FROM crm_follow_ups
            WHERE company_id = $1
        `;

        const result = await pool.query(query, [companyId]);
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching follow-up stats:', error);
        res.status(500).json({ error: 'Failed to fetch follow-up stats' });
    }
};
