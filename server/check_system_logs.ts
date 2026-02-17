
import './env';
import { pool } from './db/index.js';

import fs from 'fs';

async function check() {
    try {
        const res = await pool!.query(`
            SELECT created_at, event_type, status, message, details 
            FROM system_logs 
            WHERE (company_id = 31 OR message LIKE '%31%') 
              AND status = 'error' 
              AND created_at > NOW() - INTERVAL '24 hours'
            ORDER BY created_at DESC LIMIT 50
        `);
        console.log('Error Logs for Company 31 (last 24h):');
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
check();
