
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function run() {
    const res = await pool.query('SELECT id, name, instance_key, type, status, api_key FROM company_instances WHERE company_id = 42');
    console.log(JSON.stringify(res.rows, null, 2));
    await pool.end();
}

run();
