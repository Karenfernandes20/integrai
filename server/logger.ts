import { pool } from './db';
import { triggerWorkflow } from './controllers/workflowController';

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
    | 'campaign_retry'
    | 'evolution_success'
    | 'system_error'
    | 'auth_event'
    | 'subscription_created'
    | 'subscription_renewed';

export type LogOrigin = 'webhook' | 'user' | 'ia' | 'system' | 'evolution' | 'billing';

export type LogStatus = 'success' | 'error' | 'warning' | 'info';

interface LogData {
    eventType: LogEventType;
    origin: LogOrigin;
    status: LogStatus;
    message: string;
    conversationId?: number;
    companyId?: number;
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

        const { eventType, origin, status, message, conversationId, companyId, phone, details } = data;

        const result = await pool.query(
            `INSERT INTO system_logs (event_type, origin, status, message, conversation_id, company_id, phone, details)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
            [eventType, origin, status, message, conversationId, companyId, phone, details || {}]
        );

        const logId = result.rows[0]?.id;

        // Auto-create alert if it's an error
        if (status === 'error') {
            await pool.query(
                `INSERT INTO admin_alerts (type, description, log_id)
                 VALUES ($1, $2, $3)`,
                [eventType, message, logId]
            );

            // Trigger Workflow Engine
            triggerWorkflow('error_detected', {
                event_type: eventType,
                message: message,
                origin: origin,
                details: details
            }).catch(e => console.error('[Workflow Trigger Error]:', e));
        }

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
