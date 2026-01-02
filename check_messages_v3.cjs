
const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');
const { URL } = require('url');

dotenv.config({ path: path.join(__dirname, '.env') });

async function check() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        console.log('DATABASE_URL não encontrada no .env');
        return;
    }

    let poolConfig;
    try {
        const url = new URL(databaseUrl);
        poolConfig = {
            user: url.username,
            password: url.password,
            host: url.hostname,
            port: parseInt(url.port || '5432'),
            database: url.pathname.slice(1),
            ssl: { rejectUnauthorized: false },
            family: 4
        };
    } catch (e) {
        poolConfig = { connectionString: databaseUrl, ssl: { rejectUnauthorized: false } };
    }

    const pool = new Pool(poolConfig);

    try {
        const res = await pool.query('SELECT count(*) FROM whatsapp_messages WHERE direction = $1', ['inbound']);
        console.log(`Mensagens Inbound no Banco: ${res.rows[0].count}`);

        const total = await pool.query('SELECT count(*) FROM whatsapp_messages');
        console.log(`Total de mensagens no Banco: ${total.rows[0].count}`);

        if (res.rows[0].count > 0) {
            const last = await pool.query('SELECT content, sent_at, external_id FROM whatsapp_messages WHERE direction = $1 ORDER BY sent_at DESC LIMIT 5', ['inbound']);
            console.log('Ultimas 5 mensagens INBOUND:');
            console.table(last.rows);
        }

        // Check if there are any conversations at all
        const convs = await pool.query('SELECT count(*) FROM whatsapp_conversations');
        console.log(`Total de conversas no Banco: ${convs.rows[0].count}`);

    } catch (e) {
        console.error('Erro ao conectar/consultar:', e.message);
    } finally {
        await pool.end();
    }
}

check();
