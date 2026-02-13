
import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        console.log('Adding columns to whatsapp_messages...');
        await pool.query('ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS sent_by_user_id INTEGER REFERENCES app_users(id)');
        await pool.query('ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS sent_by_user_name TEXT');
        console.log('✅ Columns added successfully');
    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        await pool.end();
    }
}

run();
