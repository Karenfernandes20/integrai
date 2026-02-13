
import './env';
import { pool } from './db';

async function check() {
    try {
        const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'system_logs'");
        console.log('Columns in system_logs:', res.rows.map(r => r.column_name));
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
check();
