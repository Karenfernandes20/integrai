
import { Request, Response } from 'express';
import { pool } from '../../db';

export const getInternalMessages = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const { otherUserId } = req.params;

        // Fetch messages between user and otherUserId
        const result = await pool!.query(
            `SELECT m.*, u.full_name as sender_name 
             FROM internal_messages m
             JOIN app_users u ON m.sender_id = u.id
             WHERE (m.sender_id = $1 AND m.receiver_id = $2)
                OR (m.sender_id = $2 AND m.receiver_id = $1)
             ORDER BY m.created_at ASC`,
            [user.id, otherUserId]
        );
        res.json(result.rows);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const sendInternalMessage = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const { receiverId, content } = req.body;
        const io = req.app.get('io');

        const result = await pool!.query(
            `INSERT INTO internal_messages (sender_id, receiver_id, content)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [user.id, receiverId, content]
        );

        const msg = result.rows[0];

        // Notify via socket
        if (io) {
            io.to(`user_${receiverId}`).emit('internal_message:new', {
                ...msg,
                sender_name: user.full_name
            });
        }

        res.status(201).json(msg);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getUnreadInternalCount = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const result = await pool!.query(
            `SELECT COUNT(*) as count FROM internal_messages 
             WHERE receiver_id = $1 AND is_read = false`,
            [user.id]
        );
        res.json({ count: parseInt(result.rows[0].count) });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const markInternalAsRead = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const { senderId } = req.params;
        await pool!.query(
            `UPDATE internal_messages SET is_read = true 
             WHERE receiver_id = $1 AND sender_id = $2`,
            [user.id, senderId]
        );
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};
