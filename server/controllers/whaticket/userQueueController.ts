
import { Request, Response } from 'express';
import { pool } from '../../db';

export const getUserQueues = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const result = await pool!.query(
            `SELECT q.id, q.name 
             FROM queues q
             JOIN whatsapp_queues_users wqu ON q.id = wqu.queue_id
             WHERE wqu.user_id = $1`,
            [userId]
        );
        res.json(result.rows);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const setUserQueues = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const { queueIds } = req.body; // Array of numbers

        if (!Array.isArray(queueIds)) {
            return res.status(400).json({ error: 'queueIds must be an array' });
        }

        const client = await pool!.connect();
        try {
            await client.query('BEGIN');
            await client.query('DELETE FROM whatsapp_queues_users WHERE user_id = $1', [userId]);

            if (queueIds.length > 0) {
                for (const qId of queueIds) {
                    await client.query(
                        'INSERT INTO whatsapp_queues_users (user_id, queue_id) VALUES ($1, $2)',
                        [userId, qId]
                    );
                }
            }
            await client.query('COMMIT');
            res.json({ success: true });
        } catch (e: any) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};
