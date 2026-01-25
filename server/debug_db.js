import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    connectionString: "postgresql://postgres.hdwubhvmzfggsrtgkdlv:Klpf1212%40%40%40!@aws-0-us-west-2.pooler.supabase.com:6543/postgres?sslmode=no-verify"
});

async function test() {
    try {
        console.log('--- whatsapp_conversations sample ---');
        const res = await pool.query('SELECT * FROM whatsapp_conversations LIMIT 5');
        console.log(JSON.stringify(res.rows, null, 2));

        console.log('\n--- Count by instance ---');
        const res2 = await pool.query('SELECT instance, COUNT(*) FROM whatsapp_conversations GROUP BY instance');
        console.log(JSON.stringify(res2.rows, null, 2));

        console.log('\n--- Messages linked to conversations count ---');
        const res3 = await pool.query('SELECT COUNT(*) FROM whatsapp_messages');
        console.log('Total messages:', res3.rows[0].count);

        const res4 = await pool.query('SELECT conversation_id, COUNT(*) FROM whatsapp_messages GROUP BY conversation_id LIMIT 10');
        console.log('Messages per conversation:', JSON.stringify(res4.rows, null, 2));

    } catch (e) {
        console.error(e.message);
    } finally {
        await pool.end();
    }
}

test();
