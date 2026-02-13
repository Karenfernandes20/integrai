
import './env';
import { pool } from './db';

async function check() {
    try {
        const res = await pool.query(`
            SELECT * FROM system_logs 
            WHERE created_at > NOW() - INTERVAL '30 minutes'
            AND (message ILIKE '%Instagram%' OR details::text ILIKE '%Instagram%')
            ORDER BY created_at DESC
        `);
        console.log('Results found:', res.rows.length);
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
check();
