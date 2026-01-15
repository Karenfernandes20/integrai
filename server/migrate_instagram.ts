
import './env';
import { pool } from './db/index';

async function main() {
    try {
        if (!pool) {
            console.error("Pool not initialized");
            return;
        }

        console.log("Starting Migration for Instagram Integration...");

        // 1. Update Companies Table
        await pool.query(`
            ALTER TABLE companies
            ADD COLUMN IF NOT EXISTS instagram_enabled BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS instagram_app_id VARCHAR(255),
            ADD COLUMN IF NOT EXISTS instagram_app_secret VARCHAR(255),
            ADD COLUMN IF NOT EXISTS instagram_page_id VARCHAR(255),
            ADD COLUMN IF NOT EXISTS instagram_business_id VARCHAR(255),
            ADD COLUMN IF NOT EXISTS instagram_access_token TEXT,
            ADD COLUMN IF NOT EXISTS instagram_token_expires_at TIMESTAMP;
        `);
        console.log("Updated 'companies' table.");

        // 2. Update Conversations Table to support multi-channel
        await pool.query(`
            ALTER TABLE whatsapp_conversations
            ADD COLUMN IF NOT EXISTS channel VARCHAR(50) DEFAULT 'whatsapp',
            ADD COLUMN IF NOT EXISTS instagram_user_id VARCHAR(255),
            ADD COLUMN IF NOT EXISTS instagram_username VARCHAR(255);
        `);
        console.log("Updated 'whatsapp_conversations' table.");

        // 3. Update Messages Table
        // Ideally we track channel per message too, but conversation channel is primary.
        // We might want to know if a message came from instagram specifically if we mix channels in valid omnichain (future proofing)
        await pool.query(`
            ALTER TABLE whatsapp_messages
            ADD COLUMN IF NOT EXISTS channel VARCHAR(50) DEFAULT 'whatsapp',
            ADD COLUMN IF NOT EXISTS instagram_message_id VARCHAR(255);
        `);
        console.log("Updated 'whatsapp_messages' table.");

    } catch (e) {
        console.error("Migration Failed:", e);
    } finally {
        await pool.end();
    }
}

main();
