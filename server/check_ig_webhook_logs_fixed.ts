
import './env';
import { pool } from './db';

async function check() {
    try {
        console.log('Checking for recent Instagram Webhook logs...');
        const res = await pool.query(`
            SELECT event_type, message, details, created_at 
            FROM system_logs 
            WHERE event_type = 'webhook_received' AND message = 'Instagram Webhook Received'
            ORDER BY created_at DESC 
            LIMIT 10
        `);

        if (res.rows.length === 0) {
            console.log('No Instagram Webhook logs found.');
        } else {
            console.log('Found Instagram Webhook logs:');
            console.log(JSON.stringify(res.rows, null, 2));
        }
    } catch (e) {
        console.error('Error querying system_logs:', e);
    }
    process.exit(0);
}

check();
