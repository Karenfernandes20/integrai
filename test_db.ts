
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function test() {
    try {
        const res = await pool.query('SELECT NOW()');
        console.log(res.rows[0]);
        await pool.end();
    } catch (err) {
        console.error('ERROR_TEST:', err);
    }
}

test();
