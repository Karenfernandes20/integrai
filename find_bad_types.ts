import './server/env.js';
import { pool } from './server/db/index.js';

async function run() {
    if (!pool) return;
    const res = await pool.query(`
        SELECT table_name, column_name, data_type 
        FROM information_schema.columns 
        WHERE (column_name LIKE '%jid%' OR column_name LIKE '%phone%' OR column_name LIKE '%external%' OR column_name LIKE '%chat_id%')
        AND data_type NOT IN ('text', 'character varying', 'timestamp with time zone', 'timestamp without time zone', 'boolean')
        ORDER BY table_name, column_name
    `);
    console.log(JSON.stringify(res.rows, null, 2));
    process.exit(0);
}
run();
