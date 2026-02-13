import './server/env.js';
import { pool } from './server/db/index.js';

async function run() {
    if (!pool) return;
    const tables = ['whatsapp_conversations', 'whatsapp_contacts', 'contacts', 'crm_leads', 'company_instances', 'conversations_tags'];
    const res = await pool.query(`
        SELECT table_name, column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = ANY($1)
        ORDER BY table_name, column_name
    `, [tables]);
    console.log(JSON.stringify(res.rows, null, 2));
    process.exit(0);
}
run();
