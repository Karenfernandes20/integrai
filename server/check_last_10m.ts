
import './env';
import { pool } from './db';

async function check() {
    try {
        const res = await pool.query(`
            SELECT id, event_type, message, details, created_at 
            FROM system_logs 
            WHERE created_at > NOW() - INTERVAL '10 minutes'
            ORDER BY created_at DESC 
            LIMIT 20
        `);
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
check();
