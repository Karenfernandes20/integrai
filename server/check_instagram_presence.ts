
import './env';
import { pool } from './db';

async function check() {
    try {
        const res = await pool.query(`
            SELECT COUNT(*) FROM whatsapp_messages WHERE channel = 'instagram'
        `);
        console.log('Total Instagram Messages:', res.rows[0].count);

        if (parseInt(res.rows[0].count) > 0) {
            const res2 = await pool.query(`
                SELECT c.name as company, m.content, m.sent_at 
                FROM whatsapp_messages m 
                JOIN companies c ON m.company_id = c.id 
                WHERE m.channel = 'instagram'
                ORDER BY m.sent_at DESC 
                LIMIT 5
            `);
            console.log(JSON.stringify(res2.rows, null, 2));
        }
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
check();
