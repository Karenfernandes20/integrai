
import './env';
import { pool } from './db';

async function check() {
    try {
        const res = await pool.query(`
            SELECT c.name as company, m.content, m.channel, m.direction, m.sent_at 
            FROM whatsapp_messages m 
            JOIN companies c ON m.company_id = c.id 
            ORDER BY m.sent_at DESC 
            LIMIT 20
        `);
        console.log('Recent Messages:');
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
check();
