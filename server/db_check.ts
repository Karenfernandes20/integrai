import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function check() {
    try {
        const res = await pool.query("SELECT id, name, evolution_instance, evolution_apikey FROM companies WHERE LOWER(name) LIKE '%viamove%' OR LOWER(evolution_instance) LIKE '%viamove%';");
        console.log(JSON.stringify(res.rows, null, 2));
        await pool.end();
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

check();
