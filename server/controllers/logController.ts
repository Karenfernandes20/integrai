import { Request, Response } from 'express';
import { pool } from '../db';

export const getSystemLogs = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        const user = (req as any).user;
        if (user.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const { event_type, status, origin, search, start_date, end_date, limit = 100, offset = 0 } = req.query;

        let query = `
            SELECT * FROM system_logs 
            WHERE 1=1
        `;
        const params: any[] = [];

        if (event_type) {
            params.push(event_type);
            query += ` AND event_type = $${params.length}`;
        }

        if (status) {
            params.push(status);
            query += ` AND status = $${params.length}`;
        }

        if (origin) {
            params.push(origin);
            query += ` AND origin = $${params.length}`;
        }

        if (start_date) {
            params.push(start_date);
            query += ` AND created_at >= $${params.length}`;
        }

        if (end_date) {
            params.push(end_date);
            query += ` AND created_at <= $${params.length}`;
        }

        if (search) {
            params.push(`%${search}%`);
            query += ` AND (message ILIKE $${params.length} OR phone ILIKE $${params.length} OR CAST(details AS TEXT) ILIKE $${params.length})`;
        }

        // Sorting: Always chronological descending
        query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);

        // Get total count for pagination
        const countQuery = query.split('ORDER BY')[0].replace('SELECT *', 'SELECT COUNT(*)');
        const countParams = params.slice(0, -2);
        const countResult = await pool.query(countQuery, countParams);

        res.json({
            logs: result.rows,
            total: parseInt(countResult.rows[0].count),
            limit: parseInt(limit as string),
            offset: parseInt(offset as string)
        });
    } catch (error) {
        console.error('Error fetching system logs:', error);
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
};

export const getLogStats = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        const user = (req as any).user;
        if (user.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Stats for the last 24 hours
        const stats = await pool.query(`
            SELECT 
                status, 
                COUNT(*) as count 
            FROM system_logs 
            WHERE created_at >= NOW() - INTERVAL '24 hours'
            GROUP BY status
        `);

        const errorsByOrigin = await pool.query(`
            SELECT 
                origin, 
                COUNT(*) as count 
            FROM system_logs 
            WHERE status = 'error' AND created_at >= NOW() - INTERVAL '24 hours'
            GROUP BY origin
        `);

        res.json({
            last24h: stats.rows,
            errorsByOrigin: errorsByOrigin.rows
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
};
