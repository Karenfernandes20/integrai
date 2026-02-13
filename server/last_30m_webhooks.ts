
import './env';
import { pool } from './db';

async function check() {
    const res = await pool.query("SELECT * FROM system_logs WHERE event_type = 'webhook_received' AND created_at > NOW() - INTERVAL '30 minutes' ORDER BY created_at DESC");
    console.log(`Found ${res.rows.length} logs.`);
    console.log(JSON.stringify(res.rows, null, 2));
    process.exit(0);
}
check();
