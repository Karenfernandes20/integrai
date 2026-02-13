
import './env';
import { pool } from './db';

async function check() {
    try {
        const res = await pool.query(`
            SELECT * FROM whatsapp_conversations WHERE channel = 'instagram'
        `);
        console.log('Instagram Conversations:');
        console.log(JSON.stringify(res.rows, null, 2));

        const res2 = await pool.query(`
            SELECT * FROM whatsapp_messages WHERE channel = 'instagram' ORDER BY sent_at DESC LIMIT 10
        `);
        console.log('Recent Instagram Messages:');
        console.log(JSON.stringify(res2.rows, null, 2));

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

check();
