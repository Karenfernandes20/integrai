import { Request, Response } from 'express';
import { pool } from '../db';
import { logAudit } from '../auditLogger';

// GET all templates for a company
export const getTemplates = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        const user = (req as any).user;
        const companyId = user?.company_id;
        const { type } = req.query;

        let query = 'SELECT * FROM global_templates WHERE (company_id = $1 OR company_id IS NULL) AND is_active = TRUE';
        const params = [companyId];

        if (type) {
            query += ' AND type = $2';
            params.push(type as any);
        }

        query += ' ORDER BY type ASC, name ASC';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching templates:', error);
        res.status(500).json({ error: 'Failed to fetch templates' });
    }
};

// CREATE new template
export const createTemplate = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        const user = (req as any).user;
        const companyId = user?.company_id;
        const { name, type, content, variables } = req.body;

        if (!name || !type || !content) {
            return res.status(400).json({ error: 'Name, type and content are required' });
        }

        const result = await pool.query(
            `INSERT INTO global_templates (company_id, name, type, content, variables, created_by)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [companyId, name, type, content, JSON.stringify(variables || []), user.id]
        );

        const newTemplate = result.rows[0];

        await logAudit({
            userId: user.id,
            companyId: companyId,
            action: 'create',
            resourceType: 'template',
            resourceId: newTemplate.id.toString(),
            details: JSON.stringify({ name, type })
        });

        res.status(201).json(newTemplate);
    } catch (error) {
        console.error('Error creating template:', error);
        res.status(500).json({ error: 'Failed to create template' });
    }
};

// UPDATE template (with versioning)
export const updateTemplate = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        const user = (req as any).user;
        const companyId = user?.company_id;
        const { id } = req.params;
        const { name, content, variables, createNewVersion } = req.body;

        // Fetch current template
        const currentResult = await pool.query(
            'SELECT * FROM global_templates WHERE id = $1 AND (company_id = $2 OR company_id IS NULL)',
            [id, companyId]
        );

        if (currentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Template not found' });
        }

        const current = currentResult.rows[0];

        if (createNewVersion) {
            // Deactivate current
            await pool.query('UPDATE global_templates SET is_active = FALSE WHERE id = $1', [id]);

            // Create new version
            const newRes = await pool.query(
                `INSERT INTO global_templates (parent_id, company_id, name, type, content, variables, version, created_by)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 RETURNING *`,
                [
                    current.parent_id || current.id,
                    companyId,
                    name || current.name,
                    current.type,
                    content || current.content,
                    JSON.stringify(variables || current.variables),
                    (current.version || 1) + 1,
                    user.id
                ]
            );

            const updated = newRes.rows[0];

            await logAudit({
                userId: user.id,
                companyId: companyId,
                action: 'version_update',
                resourceType: 'template',
                resourceId: updated.id.toString(),
                details: JSON.stringify({ oldId: id, newVersion: updated.version })
            });

            return res.json(updated);
        } else {
            // SIMPLE UPDATE
            const updateRes = await pool.query(
                `UPDATE global_templates 
                 SET name = COALESCE($1, name),
                     content = COALESCE($2, content),
                     variables = COALESCE($3, variables),
                     updated_at = NOW()
                 WHERE id = $4
                 RETURNING *`,
                [name, content, JSON.stringify(variables), id]
            );

            await logAudit({
                userId: user.id,
                companyId: companyId,
                action: 'update',
                resourceType: 'template',
                resourceId: id,
                details: JSON.stringify({ name })
            });

            return res.json(updateRes.rows[0]);
        }
    } catch (error) {
        console.error('Error updating template:', error);
        res.status(500).json({ error: 'Failed to update template' });
    }
};

// DELETE (soft delete)
export const deleteTemplate = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        const user = (req as any).user;
        const companyId = user?.company_id;
        const { id } = req.params;

        await pool.query(
            'UPDATE global_templates SET is_active = FALSE WHERE id = $1 AND (company_id = $2 OR company_id IS NULL)',
            [id, companyId]
        );

        await logAudit({
            userId: user.id,
            companyId: companyId,
            action: 'delete',
            resourceType: 'template',
            resourceId: id
        });

        res.json({ message: 'Template deleted' });
    } catch (error) {
        console.error('Error deleting template:', error);
        res.status(500).json({ error: 'Failed to delete template' });
    }
};

// GET template versions
export const getTemplateHistory = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        const { id } = req.params;
        const user = (req as any).user;
        const companyId = user?.company_id;

        // Find the root parent or use the current if it's already a parent
        const rootRes = await pool.query(
            'SELECT COALESCE(parent_id, id) as root_id FROM global_templates WHERE id = $1',
            [id]
        );

        if (rootRes.rows.length === 0) return res.status(404).json({ error: 'Template not found' });

        const rootId = rootRes.rows[0].root_id;

        const history = await pool.query(
            `SELECT * FROM global_templates 
             WHERE (id = $1 OR parent_id = $1) AND (company_id = $2 OR company_id IS NULL)
             ORDER BY version DESC`,
            [rootId, companyId]
        );

        res.json(history.rows);
    } catch (error) {
        console.error('Error fetching template history:', error);
        res.status(500).json({ error: 'Failed to fetch history' });
    }
};
