import { Request, Response } from 'express';
import { pool } from '../db';

export const getAlerts = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        const user = (req as any).user;
        if (user.role !== 'SUPERADMIN') return res.status(403).json({ error: 'Access denied' });

        const result = await pool.query(`
            SELECT a.*, l.event_type, l.origin 
            FROM admin_alerts a
            LEFT JOIN system_logs l ON a.log_id = l.id
            ORDER BY a.created_at DESC
            LIMIT 50
        `);

        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch alerts' });
    }
};

export const markAlertAsRead = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        const { id } = req.params;
        await pool.query('UPDATE admin_alerts SET is_read = TRUE WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update alert' });
    }
};

export const markAllAlertsAsRead = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });
        await pool.query('UPDATE admin_alerts SET is_read = TRUE');
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update alerts' });
    }
};

export const deleteAlert = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });
        const { id } = req.params;
        await pool.query('DELETE FROM admin_alerts WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete alert' });
    }
};

export const getUnreadAlertsCount = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });
        const result = await pool.query('SELECT COUNT(*) FROM admin_alerts WHERE is_read = FALSE');
        res.json({ count: parseInt(result.rows[0].count) });
    } catch (error) {
        res.status(500).json({ error: 'Failed to count alerts' });
    }
};
