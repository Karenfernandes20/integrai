import './server/env.js';
import { pool } from './server/db/index.js';

async function run() {
    if (!pool) return;
    console.log("Starting DB Fix for External IDs...");

    const queries = [
        // Ensure crm_leads.phone is TEXT (or character varying is fine, but lets standardize)
        `ALTER TABLE crm_leads ALTER COLUMN phone TYPE TEXT;`,
        // Ensure whatsapp_conversations columns
        `ALTER TABLE whatsapp_conversations ALTER COLUMN external_id TYPE TEXT;`,
        `ALTER TABLE whatsapp_conversations ALTER COLUMN phone TYPE TEXT;`,
        `ALTER TABLE whatsapp_conversations ALTER COLUMN instagram_user_id TYPE TEXT;`,
        `ALTER TABLE whatsapp_conversations ALTER COLUMN instagram_username TYPE TEXT;`,
        // Ensure whatsapp_contacts
        `ALTER TABLE whatsapp_contacts ALTER COLUMN jid TYPE TEXT;`,
        `ALTER TABLE whatsapp_contacts ALTER COLUMN phone TYPE TEXT;`,
        // Ensure whatsapp_messages
        `ALTER TABLE whatsapp_messages ALTER COLUMN external_id TYPE TEXT;`,
        `ALTER TABLE whatsapp_messages ALTER COLUMN sender_jid TYPE TEXT;`,
    ];

    for (const q of queries) {
        try {
            await pool.query(q);
            console.log(`Executed: ${q}`);
        } catch (e) {
            console.error(`Failed: ${q}`, (e as any).message);
        }
    }

    console.log("DB Fix Completed.");
    process.exit(0);
}
run();
