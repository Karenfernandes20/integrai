import { pool } from './db';

export type LogEventType =
    | 'message_in'
    | 'message_out'
    | 'webhook_received'
    | 'webhook_error'
    | 'evolution_error'
    | 'ia_error'
    | 'db_error'
    | 'campaign_fail'
    | 'campaign_success'
    | 'system_error'
    | 'auth_event';

export type LogOrigin = 'webhook' | 'user' | 'ia' | 'system' | 'evolution';

export type LogStatus = 'success' | 'error' | 'warning' | 'info';

interface LogData {
    eventType: LogEventType;
    origin: LogOrigin;
    status: LogStatus;
    message: string;
    conversationId?: number;
    phone?: string;
    details?: any;
}

export const logEvent = async (data: LogData) => {
    try {
        if (!pool) {
            console.error('[Logger] Pool not initialized, cannot save log to DB');
            console.log(`[${data.status.toUpperCase()}] ${data.eventType} | ${data.message}`);
            return;
        }

        const { eventType, origin, status, message, conversationId, phone, details } = data;

        await pool.query(
            `INSERT INTO system_logs (event_type, origin, status, message, conversation_id, phone, details)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [eventType, origin, status, message, conversationId, phone, details || {}]
        );

        // Also output to console for server logs visibility
        const logPrefix = `[${status.toUpperCase()}] [${origin.toUpperCase()}] ${eventType}`;
        if (status === 'error') {
            console.error(`${logPrefix}: ${message}`, details);
        } else {
            console.log(`${logPrefix}: ${message}`);
        }
    } catch (error) {
        console.error('[Logger] Failed to save log to database:', error);
    }
};

export default logEvent;
