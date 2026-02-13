
import { pool } from '../index';

export const runFixInstagramTextColumns = async () => {
    if (!pool) return;
    try {
        console.log("Starting Instagram Text Column Fix Migration...");

        // whatsapp_messages
        await pool.query('ALTER TABLE whatsapp_messages ALTER COLUMN external_id TYPE TEXT');
        await pool.query('ALTER TABLE whatsapp_messages ALTER COLUMN sender_jid TYPE TEXT');
        await pool.query('ALTER TABLE whatsapp_messages ALTER COLUMN instagram_message_id TYPE TEXT');

        // whatsapp_conversations
        await pool.query('ALTER TABLE whatsapp_conversations ALTER COLUMN external_id TYPE TEXT');
        await pool.query('ALTER TABLE whatsapp_conversations ALTER COLUMN phone TYPE TEXT');
        await pool.query('ALTER TABLE whatsapp_conversations ALTER COLUMN instance TYPE TEXT');
        await pool.query('ALTER TABLE whatsapp_conversations ALTER COLUMN instagram_user_id TYPE TEXT');
        await pool.query('ALTER TABLE whatsapp_conversations ALTER COLUMN instagram_username TYPE TEXT');
        await pool.query('ALTER TABLE whatsapp_conversations ALTER COLUMN messenger_user_id TYPE TEXT');

        // whatsapp_contacts
        await pool.query('ALTER TABLE whatsapp_contacts ALTER COLUMN jid TYPE TEXT');
        await pool.query('ALTER TABLE whatsapp_contacts ALTER COLUMN name TYPE TEXT');
        await pool.query('ALTER TABLE whatsapp_contacts ALTER COLUMN push_name TYPE TEXT');
        await pool.query('ALTER TABLE whatsapp_contacts ALTER COLUMN instance TYPE TEXT');

        console.log("Instagram Text Column Fix Migration finished.");
    } catch (e) {
        console.error("Instagram Text Column Fix Migration Error (might already be applied):", e);
    }
};
