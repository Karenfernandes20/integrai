
import './env';
import { pool } from './db';

async function check() {
    try {
        console.log('Checking for ALL recent webhook_received logs...');
        const res = await pool.query(`
            SELECT id, event_type, message, details, created_at 
            FROM system_logs 
            WHERE event_type = 'webhook_received' 
            ORDER BY created_at DESC 
            LIMIT 10
        `);
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
check();
