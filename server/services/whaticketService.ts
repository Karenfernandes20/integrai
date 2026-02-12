
import { pool } from '../db';
import { sendWhatsAppMessage } from './whatsappService';

export const handleWhaticketGreeting = async (
    conversationId: number,
    companyId: number,
    phone: string,
    isNew: boolean,
    previousStatus: string,
    io: any
) => {
    try {
        if (!pool) return;

        // 1. Check if greeting is needed
        // Conditions: 
        // - Inbound message
        // - conversation was just created (isNew) OR was CLOSED
        if (!isNew && previousStatus !== 'CLOSED') {
            return;
        }

        // 2. Resolve Queue and its Greeting
        const convRes = await pool.query(
            'SELECT queue_id FROM whatsapp_conversations WHERE id = $1',
            [conversationId]
        );
        const queueId = convRes.rows[0]?.queue_id;

        if (!queueId) return;

        const queueRes = await pool.query(
            'SELECT greeting_message FROM queues WHERE id = $1',
            [queueId]
        );

        const greeting = queueRes.rows[0]?.greeting_message;

        if (greeting && greeting.trim()) {
            console.log(`[Whaticket] Sending greeting to ${phone} for conversation ${conversationId}`);
            await sendWhatsAppMessage({
                companyId,
                phone,
                message: greeting,
                io,
                userId: null // System sent
            });
        }
    } catch (error) {
        console.error('[Whaticket Service] Error in handleWhaticketGreeting:', error);
    }
};

export const canReopenTicket = async (companyId: number, lastMessageAt: Date | string | null): Promise<boolean> => {
    if (!lastMessageAt) return true;

    try {
        const compRes = await pool!.query(
            'SELECT ticket_reopen_timeout_hours FROM companies WHERE id = $1',
            [companyId]
        );

        const timeoutHours = compRes.rows[0]?.ticket_reopen_timeout_hours || 24;
        const lastDate = typeof lastMessageAt === 'string' ? new Date(lastMessageAt) : lastMessageAt;
        const diffMs = Date.now() - lastDate.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);

        return diffHours <= timeoutHours;
    } catch (e) {
        return true; // Default to allow
    }
};
