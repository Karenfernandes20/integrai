
import { Request, Response } from 'express';
import { pool } from '../db';
import { logAudit } from '../auditLogger';

export const getTags = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });
        const user = (req as any).user;
        const companyId = user.company_id;

        const result = await pool.query(`
            SELECT * FROM crm_tags 
            WHERE company_id = $1 
            ORDER BY name ASC
        `, [companyId]);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching tags:', error);
        res.status(500).json({ error: 'Failed to fetch tags' });
    }
};

export const createTag = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });
        const user = (req as any).user;
        const companyId = user.company_id;
        const { name, color } = req.body;

        if (!name) return res.status(400).json({ error: 'Name is required' });

        const result = await pool.query(`
            INSERT INTO crm_tags (name, color, company_id) 
            VALUES ($1, $2, $3) 
            RETURNING *
        `, [name, color || '#cbd5e1', companyId]);

        const newTag = result.rows[0];

        await logAudit({
            userId: user.id,
            companyId,
            action: 'create',
            resourceType: 'tag',
            resourceId: newTag.id,
            newValues: newTag,
            details: `Created tag: ${newTag.name}`
        });

        res.status(201).json(newTag);
    } catch (error) {
        console.error('Error creating tag:', error);
        res.status(500).json({ error: 'Failed to create tag' });
    }
};

export const updateTag = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });
        const user = (req as any).user;
        const companyId = user.company_id;
        const { id } = req.params;
        const { name, color } = req.body;

        const result = await pool.query(`
            UPDATE crm_tags 
            SET name = COALESCE($1, name), 
                color = COALESCE($2, color),
                updated_at = NOW()
            WHERE id = $3 AND company_id = $4
            RETURNING *
        `, [name, color, id, companyId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Tag not found' });
        }

        const updatedTag = result.rows[0];

        await logAudit({
            userId: user.id,
            companyId,
            action: 'update',
            resourceType: 'tag',
            resourceId: updatedTag.id,
            newValues: updatedTag,
            details: `Updated tag: ${updatedTag.name}`
        });

        res.json(updatedTag);
    } catch (error) {
        console.error('Error updating tag:', error);
        res.status(500).json({ error: 'Failed to update tag' });
    }
};

export const deleteTag = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });
        const user = (req as any).user;
        const companyId = user.company_id;
        const { id } = req.params;

        // Force delete from relation table first just in case cascade doesn't kick in instantly or for sanity
        // Actually defined CASCADE but executed queries explicitly is safer? CASCADE is fine.

        const result = await pool.query(`
            DELETE FROM crm_tags 
            WHERE id = $1 AND company_id = $2
            RETURNING *
        `, [id, companyId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Tag not found' });
        }

        const deletedTag = result.rows[0];

        await logAudit({
            userId: user.id,
            companyId,
            action: 'delete',
            resourceType: 'tag',
            resourceId: deletedTag.id,
            oldValues: deletedTag,
            details: `Deleted tag: ${deletedTag.name}`
        });

        res.json({ message: 'Tag deleted successfully' });
    } catch (error) {
        console.error('Error deleting tag:', error);
        res.status(500).json({ error: 'Failed to delete tag' });
    }
};
