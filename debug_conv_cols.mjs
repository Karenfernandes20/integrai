
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    connectionString: 'postgresql://postgres.hdwubhvmzfggsrtgkdlv:bWAxkRV4Gb7VRw88@aws-0-us-west-2.pooler.supabase.com:5432/postgres',
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        const columns = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'whatsapp_conversations'");
        columns.rows.forEach(r => console.log(r.column_name));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
