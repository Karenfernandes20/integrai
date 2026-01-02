
const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

async function check() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('render.com') ? { rejectUnauthorized: false } : false
    });

    try {
        const res = await pool.query('SELECT count(*) FROM whatsapp_messages WHERE direction = $1', ['inbound']);
        console.log(`Mensagens Inbound no Banco: ${res.rows[0].count}`);

        if (res.rows[0].count > 0) {
            const last = await pool.query('SELECT content, sent_at FROM whatsapp_messages WHERE direction = $1 ORDER BY sent_at DESC LIMIT 5', ['inbound']);
            console.log('Ultimas 5 mensagens:');
            console.table(last.rows);
        }
    } catch (e) {
        console.error('Erro ao conectar/consultar:', e.message);
    } finally {
        await pool.end();
    }
}

check();
