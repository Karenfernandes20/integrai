
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    family: 4
});

async function test() {
    try {
        const res = await pool.query('SELECT name, evolution_instance FROM companies');
        console.log('RESULT:' + JSON.stringify(res.rows));
    } catch (err) {
        console.log('ERR:' + err.message);
    } finally {
        await pool.end();
    }
}
test();
