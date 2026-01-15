import { pool } from '../db';
import { sendWhatsAppMessage } from './whatsappService';

export const processFollowUps = async (io?: any) => {
    if (!pool) return;

    try {
        // Find pending follow-ups that are due
        const query = `
            SELECT f.*, c.name as company_name 
            FROM crm_follow_ups f
            JOIN companies c ON f.company_id = c.id
            WHERE f.status = 'pending' 
            AND f.scheduled_at <= NOW()
            AND f.type = 'whatsapp'
            AND f.message IS NOT NULL 
            AND f.message != ''
            AND f.phone IS NOT NULL
            AND f.phone != ''
        `;

        const result = await pool.query(query);
        const followUps = result.rows;

        if (followUps.length === 0) return;

        console.log(`[Follow-Up Scheduler] Found ${followUps.length} messages to send.`);

        for (const followUp of followUps) {
            try {
                console.log(`[Follow-Up Scheduler] Sending message to ${followUp.phone} for company ${followUp.company_id}`);

                const sendResult = await sendWhatsAppMessage({
                    companyId: followUp.company_id,
                    phone: followUp.phone,
                    message: followUp.message,
                    contactName: followUp.contact_name,
                    userId: followUp.user_id,
                    io,
                    followUpId: followUp.id
                });

                if (sendResult.success) {
                    // Update status to completed
                    await pool.query(
                        'UPDATE crm_follow_ups SET status = $1, completed_at = NOW(), updated_at = NOW() WHERE id = $2',
                        ['completed', followUp.id]
                    );
                    console.log(`[Follow-Up Scheduler] Follow-up ${followUp.id} marked as completed.`);
                } else {
                    console.error(`[Follow-Up Scheduler] Failed to send follow-up ${followUp.id}: ${sendResult.error}`);
                    // If it failed, maybe we should retry later or mark as failed?
                    // For now, let's keep it pending but maybe add a retry count if we had one.
                    // Or mark as failed to avoid infinite loop of failures.
                    await pool.query(
                        'UPDATE crm_follow_ups SET updated_at = NOW(), description = COALESCE(description, \'\') || $1 WHERE id = $2',
                        [`\n[Erro de Envio em ${new Date().toLocaleString()}]: ${sendResult.error}`, followUp.id]
                    );
                }
            } catch (err) {
                console.error(`[Follow-Up Scheduler] Error processing follow-up ${followUp.id}:`, err);
            }
        }
    } catch (error) {
        console.error('[Follow-Up Scheduler] Fatal Error:', error);
    }
};
