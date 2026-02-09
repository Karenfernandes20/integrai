const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function debug() {
    try {
        const res = await pool.query(`
            SELECT id, title, start_time::text, end_time::text, status, responsible_id, company_id 
            FROM crm_appointments 
            ORDER BY id DESC 
            LIMIT 1
        `);
        console.log(JSON.stringify(res.rows[0], null, 2));
        pool.end();
    } catch (e) {
        console.error(e);
        pool.end();
    }
}
debug();
