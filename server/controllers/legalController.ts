
import { Request, Response } from 'express';
import { pool } from '../db';
import { logEvent } from '../logger';

export const getLegalPage = async (req: Request, res: Response) => {
    try {
        const { type } = req.params;
        if (!['terms', 'privacy'].includes(type)) {
            return res.status(400).json({ error: 'Tipo de página inválido' });
        }

        const result = await pool!.query(`
            SELECT p.*, u.full_name as updated_by_name 
            FROM legal_pages p
            LEFT JOIN app_users u ON p.last_updated_by = u.id
            WHERE p.type = $1
        `, [type]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Página não encontrada' });
        }

        res.json(result.rows[0]);
    } catch (error: any) {
        console.error('Error fetching legal page:', error);
        res.status(500).json({ error: 'Erro interno ao buscar página legal' });
    }
};

export const updateLegalPage = async (req: Request, res: Response) => {
    try {
        const { type } = req.params;
        const { content } = req.body;
        const userId = (req as any).user.id;

        if (!['terms', 'privacy'].includes(type)) {
            return res.status(400).json({ error: 'Tipo de página inválido' });
        }

        const result = await pool!.query(`
            UPDATE legal_pages 
            SET content = $1, last_updated_at = NOW(), last_updated_by = $2
            WHERE type = $3
            RETURNING *
        `, [content, userId, type]);

        if (result.rows.length === 0) {
            // Fallback insert if something deleted it
            await pool!.query(`
                INSERT INTO legal_pages (type, content, last_updated_by)
                VALUES ($1, $2, $3)
            `, [type, content, userId]);
        }

        await logEvent({
            eventType: 'legal_page_update',
            origin: 'system',
            status: 'success',
            message: `Página legal '${type}' atualizada por usuário ${userId}`,
            details: { type, userId }
        } as any);

        res.json({ success: true, message: 'Página atualizada com sucesso' });
    } catch (error: any) {
        console.error('Error updating legal page:', error);
        res.status(500).json({ error: 'Erro interno ao atualizar página' });
    }
};
