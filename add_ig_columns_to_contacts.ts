import './server/env.js';
import { pool } from './server/db/index.js';

async function run() {
    if (!pool) return;
    console.log("Adding Instagram columns to whatsapp_contacts...");

    const queries = [
        `ALTER TABLE whatsapp_contacts ADD COLUMN IF NOT EXISTS instagram_id TEXT;`,
        `ALTER TABLE whatsapp_contacts ADD COLUMN IF NOT EXISTS instagram_username TEXT;`,
        // Also ensure company_id and jid index exists (if not already there)
        `CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_jid_company ON whatsapp_contacts(jid, company_id);`
    ];

    for (const q of queries) {
        try {
            await pool.query(q);
            console.log(`Executed: ${q}`);
        } catch (e) {
            console.error(`Failed: ${q}`, (e as any).message);
        }
    }

    console.log("Migration Completed.");
    process.exit(0);
}
run();
