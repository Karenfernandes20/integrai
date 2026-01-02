
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

async function test() {
    try {
        const res = await pool.query('SELECT id, name, evolution_instance, evolution_apikey FROM companies');
        console.log('COMPANIES:', JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error('DB ERROR:', err.message);
    } finally {
        await pool.end();
    }
}
test();
