
import './server/env.js';
import { pool } from './server/db/index.js';

async function list() {
    const r = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log(JSON.stringify(r.rows, null, 2));
    process.exit(0);
}
list();
