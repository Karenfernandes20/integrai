
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function migrate() {
    try {
        await pool.query('ALTER TABLE company_instances ADD COLUMN IF NOT EXISTS default_queue_id INTEGER REFERENCES queues(id) ON DELETE SET NULL');
        console.log('Migration successful');
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

migrate();
