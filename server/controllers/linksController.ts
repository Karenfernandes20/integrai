import { Request, Response } from 'express';
import { pool } from '../db';
import { logAudit } from '../auditLogger';

export const createLink = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });
        const user = (req as any).user;
        const { source_type, source_id, target_type, target_id, link_type } = req.body;

        if (!source_type || !source_id || !target_type || !target_id) {
            return res.status(400).json({ error: 'Missing linkage parameters' });
        }

        // Check if link already exists (bidirectional check is good)
        const check = await pool.query(
            `SELECT id FROM entity_links 
             WHERE (source_type = $1 AND source_id = $2 AND target_type = $3 AND target_id = $4)
                OR (source_type = $3 AND source_id = $4 AND target_type = $1 AND target_id = $2)`,
            [source_type, source_id, target_type, target_id]
        );

        if (check.rowCount && check.rowCount > 0) {
            return res.status(400).json({ error: 'Relationship already exists' });
        }

        const result = await pool.query(
            `INSERT INTO entity_links (source_type, source_id, target_type, target_id, link_type, created_by)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [source_type, source_id, target_type, target_id, link_type || 'related', user.id]
        );

        await logAudit({
            userId: user.id,
            action: 'create',
            resourceType: 'setting',
            resourceId: result.rows[0].id,
            details: `Vinculou ${source_type} #${source_id} com ${target_type} #${target_id}`
        });

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('[createLink] Error:', error);
        res.status(500).json({ error: 'Failed to create relationship' });
    }
};

export const getLinksForEntity = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });
        const { type, id } = req.params;

        // Fetch links where entity is source OR target
        const result = await pool.query(
            `SELECT * FROM entity_links 
             WHERE (source_type = $1 AND source_id = $2)
                OR (target_type = $1 AND target_id = $2)`,
            [type, id]
        );

        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch relationships' });
    }
};

export const deleteLink = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });
        const { id } = req.params;
        const user = (req as any).user;

        const result = await pool.query('DELETE FROM entity_links WHERE id = $1 RETURNING *', [id]);

        if (result.rowCount === 0) return res.status(404).json({ error: 'Link not found' });

        await logAudit({
            userId: user.id,
            action: 'delete',
            resourceType: 'setting',
            resourceId: id,
            details: `Removeu vínculo entre entidades`
        });

        res.json({ message: 'Relationship removed' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete relationship' });
    }
};
