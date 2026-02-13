import './server/env.js';
import { pool } from './server/db/index.js';

async function check() {
    if (!pool) return;
    try {
        const res = await pool.query(`
            SELECT table_name, column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name IN ('whatsapp_conversations', 'whatsapp_contacts', 'contacts')
            AND column_name IN ('phone', 'jid', 'external_id', 'whatsapp_id', 'chat_id')
        `);
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
check();
