
import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;
const databaseUrl = process.env.DATABASE_URL;

async function check() {
    const pool = new Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
    try {
        const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        console.log("Tables:", res.rows.map(r => r.table_name).join(', '));

        const chatbots = await pool.query("SELECT * FROM information_schema.columns WHERE table_name = 'chatbots'");
        console.log("Chatbots columns:", chatbots.rows.map(r => r.column_name).join(', '));
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
check();
