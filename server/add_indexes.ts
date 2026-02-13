
import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        console.log('Checking columns...');
        const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'whatsapp_conversations'");
        console.log('Columns:', res.rows.map(r => r.column_name));

        console.log('Adding indexes...');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_messages_sent_at ON whatsapp_messages(sent_at)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_leads_created_at ON crm_leads(created_at)');
        // Check if closed_at exists before creating index
        if (res.rows.some(r => r.column_name === 'closed_at')) {
            await pool.query('CREATE INDEX IF NOT EXISTS idx_convs_closed_at ON whatsapp_conversations(closed_at)');
        }
        console.log('✅ Success');
    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        await pool.end();
    }
}

run();
