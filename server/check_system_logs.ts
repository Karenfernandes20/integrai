
import './env';
import { pool } from './db';

async function check() {
    try {
        const res = await pool.query(`
            SELECT * FROM system_logs ORDER BY created_at DESC LIMIT 20
        `);
        console.log('Recent System Logs:');
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
check();
