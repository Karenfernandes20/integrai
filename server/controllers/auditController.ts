import { Request, Response } from 'express';
import { pool } from '../db';

export const getAuditLogs = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        const user = (req as any).user;
        if (user.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const { limit = 100, offset = 0, resourceType, action } = req.query;

        let query = `
            SELECT a.*, u.full_name as user_name, c.name as company_name
            FROM audit_logs a
            LEFT JOIN app_users u ON a.user_id = u.id
            LEFT JOIN companies c ON a.company_id = c.id
        `;
        const params: any[] = [];
        let whereClauses = [];

        if (resourceType) {
            whereClauses.push(`a.resource_type = $${params.length + 1}`);
            params.push(resourceType);
        }

        if (action) {
            whereClauses.push(`a.action = $${params.length + 1}`);
            params.push(action);
        }

        if (whereClauses.length > 0) {
            query += ' WHERE ' + whereClauses.join(' AND ');
        }

        query += ` ORDER BY a.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('[getAuditLogs] Error:', error);
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
};

export const getAuditStats = async (req: Request, res: Response) => {
    try {
        const stats = await pool!.query(`
            SELECT resource_type, COUNT(*) as count 
            FROM audit_logs 
            GROUP BY resource_type 
            ORDER BY count DESC
        `);
        res.json(stats.rows);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch audit stats' });
    }
};
