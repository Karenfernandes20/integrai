import './server/env.js';
import { pool } from './server/db/index.js';

async function run() {
    if (!pool) return;
    const res = await pool.query(`
        SELECT table_name, column_name, data_type 
        FROM information_schema.columns 
        WHERE column_name IN ('jid', 'remote_jid', 'external_id', 'phone', 'whatsapp_id', 'chat_id')
        ORDER BY table_name, column_name
    `);
    console.log(JSON.stringify(res.rows, null, 2));
    process.exit(0);
}
run();
