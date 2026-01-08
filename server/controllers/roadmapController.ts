import { Request, Response } from 'express';
import { pool } from '../db';
import { logAudit } from '../auditLogger';

// GET all roadmap items
export const getRoadmapItems = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        const user = (req as any).user;
        const companyId = user?.company_id;

        // Fetch items and count comments/tasks
        const query = `
            SELECT r.*, 
                   u.name as creator_name,
                   (SELECT COUNT(*) FROM roadmap_comments WHERE roadmap_item_id = r.id) as comments_count,
                   (SELECT COUNT(*) FROM entity_links WHERE source_type = 'roadmap_item' AND source_id = r.id::text AND target_type = 'task') as tasks_count
            FROM roadmap_items r
            LEFT JOIN app_users u ON r.created_by = u.id
            WHERE (r.company_id = $1 OR r.company_id IS NULL)
            ORDER BY r.created_at DESC
        `;

        const result = await pool.query(query, [companyId]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching roadmap:', error);
        res.status(500).json({ error: 'Failed to fetch roadmap' });
    }
};

// CREATE item
export const createRoadmapItem = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        const user = (req as any).user;
        const companyId = user?.company_id;
        const { title, description, status, priority, target_date } = req.body;

        if (!title) return res.status(400).json({ error: 'Title is required' });

        const result = await pool.query(
            `INSERT INTO roadmap_items (company_id, title, description, status, priority, target_date, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [
                companyId,
                title,
                description || '',
                status || 'planned',
                priority || 'medium',
                target_date || null,
                user.id
            ]
        );

        const newItem = result.rows[0];

        await logAudit({
            userId: user.id,
            companyId,
            action: 'create',
            resourceType: 'roadmap_item' as any,
            resourceId: newItem.id,
            details: JSON.stringify({ title, status })
        });

        res.status(201).json(newItem);
    } catch (error) {
        console.error('Error creating roadmap item:', error);
        res.status(500).json({ error: 'Failed to create item' });
    }
};

// UPDATE item
export const updateRoadmapItem = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        const { id } = req.params;
        const user = (req as any).user;
        const isSuperAdmin = user?.role === 'SUPERADMIN';
        const { title, description, status, priority, target_date } = req.body;

        // Check ownership
        const check = await pool.query('SELECT company_id FROM roadmap_items WHERE id = $1', [id]);
        if (check.rows.length === 0) return res.status(404).json({ error: 'Item not found' });

        if (!isSuperAdmin && check.rows[0].company_id && check.rows[0].company_id !== user.company_id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const result = await pool.query(
            `UPDATE roadmap_items 
             SET title = COALESCE($1, title),
                 description = COALESCE($2, description),
                 status = COALESCE($3, status),
                 priority = COALESCE($4, priority),
                 target_date = $5,
                 updated_at = NOW()
             WHERE id = $6
             RETURNING *`,
            [title, description, status, priority, target_date, id]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating roadmap item:', error);
        res.status(500).json({ error: 'Failed to update item' });
    }
};

// DELETE item
export const deleteRoadmapItem = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        const { id } = req.params;
        const user = (req as any).user;
        const isSuperAdmin = user?.role === 'SUPERADMIN';

        // Check ownership
        const check = await pool.query('SELECT company_id FROM roadmap_items WHERE id = $1', [id]);
        if (check.rows.length === 0) return res.status(404).json({ error: 'Item not found' });

        if (!isSuperAdmin && check.rows[0].company_id && check.rows[0].company_id !== user.company_id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        await pool.query('DELETE FROM roadmap_items WHERE id = $1', [id]);

        await logAudit({
            userId: user.id,
            companyId: user.company_id,
            action: 'delete',
            resourceType: 'roadmap_item' as any,
            resourceId: id
        });

        res.json({ message: 'Item deleted' });
    } catch (error) {
        console.error('Error deleting roadmap item:', error);
        res.status(500).json({ error: 'Failed to delete item' });
    }
};

// COMMENTS
export const getRoadmapComments = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        const { id } = req.params;

        const result = await pool.query(
            `SELECT c.*, u.name as user_name 
             FROM roadmap_comments c
             LEFT JOIN app_users u ON c.user_id = u.id
             WHERE c.roadmap_item_id = $1
             ORDER BY c.created_at ASC`,
            [id]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching comments:', error);
        res.status(500).json({ error: 'Failed to fetch comments' });
    }
};

export const addRoadmapComment = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        const { id } = req.params;
        const user = (req as any).user;
        const { content } = req.body;

        if (!content) return res.status(400).json({ error: 'Content is required' });

        const result = await pool.query(
            `INSERT INTO roadmap_comments (roadmap_item_id, user_id, content)
             VALUES ($1, $2, $3)
             RETURNING *, (SELECT name FROM app_users WHERE id = $2) as user_name`,
            [id, user.id, content]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).json({ error: 'Failed to add comment' });
    }
};

// LINK TASK (Using entity_links)
export const linkTaskToRoadmap = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        const { id } = req.params;
        const { taskId } = req.body;
        const user = (req as any).user;

        await pool.query(
            `INSERT INTO entity_links (source_type, source_id, target_type, target_id, link_type, created_by)
             VALUES ('roadmap_item', $1, 'task', $2, 'related', $3)
             ON CONFLICT DO NOTHING`,
            [id, taskId, user.id]
        );

        res.json({ message: 'Task linked' });
    } catch (error) {
        console.error('Error linking task:', error);
        res.status(500).json({ error: 'Failed to link task' });
    }
};
