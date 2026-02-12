
import { Request, Response } from 'express';
import { pool } from '../../db';

const resolveCompanyId = (req: Request): number | null => {
    const user = (req as any).user;
    if (user?.role === 'SUPERADMIN') {
        return Number(req.query.companyId || req.body?.companyId || user?.company_id || 0) || null;
    }
    return Number(user?.company_id || 0) || null;
};

export const getQuickAnswers = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });
        const companyId = resolveCompanyId(req);
        if (!companyId) return res.status(400).json({ error: 'Company ID required' });

        const result = await pool.query(
            'SELECT * FROM whatsapp_quick_answers WHERE company_id = $1 ORDER BY shortcut ASC',
            [companyId]
        );
        res.json(result.rows);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const createQuickAnswer = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });
        const companyId = resolveCompanyId(req);
        const { shortcut, message } = req.body;

        if (!shortcut || !message) {
            return res.status(400).json({ error: 'Shortcut and message are required' });
        }

        const result = await pool.query(
            `INSERT INTO whatsapp_quick_answers (company_id, shortcut, message)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [companyId, shortcut, message]
        );
        res.status(201).json(result.rows[0]);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const updateQuickAnswer = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { shortcut, message } = req.body;
        const result = await pool!.query(
            `UPDATE whatsapp_quick_answers 
             SET shortcut = $1, message = $2, updated_at = NOW() 
             WHERE id = $3 RETURNING *`,
            [shortcut, message, id]
        );
        res.json(result.rows[0]);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const deleteQuickAnswer = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await pool!.query('DELETE FROM whatsapp_quick_answers WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};
