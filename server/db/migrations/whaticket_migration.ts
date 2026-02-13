
import { pool } from '../index';

export const runWhaticketMigrations = async () => {
    if (!pool) return;
    try {
        console.log("Starting Whaticket Modular Migrations...");

        // 1. User-Queue Association (Multi-User per Number/Queue)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS whatsapp_queues_users (
                id SERIAL PRIMARY KEY,
                queue_id INTEGER NOT NULL REFERENCES queues(id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(queue_id, user_id)
            );
        `);
        console.log("Verified table: whatsapp_queues_users");

        // 2. Quick Answers (Canned Responses)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS whatsapp_quick_answers (
                id SERIAL PRIMARY KEY,
                company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
                shortcut TEXT NOT NULL,
                message TEXT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(company_id, shortcut)
            );
        `);
        console.log("Verified table: whatsapp_quick_answers");

        // 3. Automated Messages for Queues
        await pool.query(`
            ALTER TABLE queues 
            ADD COLUMN IF NOT EXISTS greeting_message TEXT,
            ADD COLUMN IF NOT EXISTS out_of_hours_message TEXT,
            ADD COLUMN IF NOT EXISTS color VARCHAR(7) DEFAULT '#3b82f6';
        `);
        console.log("Updated table: queues (Whaticket fields)");

        // 4. Company Settings for Tickets
        await pool.query(`
            ALTER TABLE companies 
            ADD COLUMN IF NOT EXISTS ticket_reopen_timeout_hours INTEGER DEFAULT 24,
            ADD COLUMN IF NOT EXISTS whatsapp_web_js_enabled BOOLEAN DEFAULT FALSE;
        `);
        console.log("Updated table: companies (Whaticket settings)");

        // 5. Internal Chat Support
        await pool.query(`
            CREATE TABLE IF NOT EXISTS internal_messages (
                id SERIAL PRIMARY KEY,
                sender_id INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
                receiver_id INTEGER REFERENCES app_users(id) ON DELETE CASCADE, -- null for group chat if implemented
                content TEXT NOT NULL,
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);
        console.log("Verified table: internal_messages");

        console.log("Whaticket Migrations finished.");
    } catch (e) {
        console.error("Whaticket Migration Error:", e);
    }
};
