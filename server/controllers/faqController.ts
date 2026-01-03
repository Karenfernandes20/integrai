import { Request, Response } from 'express';
import { pool } from '../db';

export const createFaqQuestion = async (req: Request, res: Response) => {
    const { question } = req.body;
    const user = (req as any).user;

    if (!question) {
        return res.status(400).json({ error: 'A pergunta é obrigatória.' });
    }

    try {
        const result = await pool!.query(
            `INSERT INTO faq_questions (question, user_id, company_id) 
             VALUES ($1, $2, $3) RETURNING *`,
            [question, user.id, user.company_id]
        );

        res.status(201).json(result.rows[0]);
    } catch (error: any) {
        console.error('Error creating FAQ question:', error);
        res.status(500).json({ error: 'Erro ao enviar pergunta.' });
    }
};

export const getFaqQuestions = async (req: Request, res: Response) => {
    const user = (req as any).user;

    try {
        // Everyone can see all questions
        // We join with app_users to get the name of who asked
        const result = await pool!.query(
            `SELECT f.*, u.full_name as user_name 
             FROM faq_questions f
             LEFT JOIN app_users u ON f.user_id = u.id
             ORDER BY f.created_at DESC`
        );

        res.json(result.rows);
    } catch (error: any) {
        console.error('Error fetching FAQ questions:', error);
        res.status(500).json({ error: 'Erro ao buscar perguntas.' });
    }
};

export const answerFaqQuestion = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { answer, is_public } = req.body;
    const user = (req as any).user;

    // Only SuperAdmin can answer/edit answers
    if (user.role.toUpperCase() !== 'SUPERADMIN') {
        return res.status(403).json({ error: 'Apenas SuperAdmin pode responder.' });
    }

    try {
        const result = await pool!.query(
            `UPDATE faq_questions 
             SET answer = $1, is_answered = true, is_public = $2, updated_at = NOW()
             WHERE id = $3 RETURNING *`,
            [answer, is_public === undefined ? false : is_public, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Pergunta não encontrada.' });
        }

        res.json(result.rows[0]);
    } catch (error: any) {
        console.error('Error answering FAQ question:', error);
        res.status(500).json({ error: 'Erro ao responder pergunta.' });
    }
};

export const deleteFaqQuestion = async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = (req as any).user;

    try {
        // Check if user is the owner OR SuperAdmin
        const check = await pool!.query('SELECT user_id FROM faq_questions WHERE id = $1', [id]);

        if (check.rows.length === 0) {
            return res.status(404).json({ error: 'Pergunta não encontrada.' });
        }

        const isOwner = Number(check.rows[0].user_id) === Number(user.id);
        const isSuperAdmin = user.role.toUpperCase() === 'SUPERADMIN';

        if (!isOwner && !isSuperAdmin) {
            return res.status(403).json({ error: 'Sem permissão para excluir esta pergunta.' });
        }

        await pool!.query('DELETE FROM faq_questions WHERE id = $1', [id]);
        res.json({ message: 'Pergunta excluída com sucesso.' });
    } catch (error: any) {
        console.error('Error deleting FAQ question:', error);
        res.status(500).json({ error: 'Erro ao excluir pergunta.' });
    }
};
