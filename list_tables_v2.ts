import './server/env.js';
import { pool } from './server/db/index.js';

async function run() {
    if (!pool) return;
    const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
    console.log(JSON.stringify(res.rows.map(r => r.table_name), null, 2));
    process.exit(0);
}
run();
