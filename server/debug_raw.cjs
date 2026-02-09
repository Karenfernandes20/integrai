const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function debug() {
    try {
        console.log("--- DEBUG START AND END ---");

        // Ensure we see exact stored chars
        const res = await pool.query(`
            SELECT id, title, start_time::text, end_time::text, company_id 
            FROM crm_appointments 
            ORDER BY id DESC 
            LIMIT 3
        `);
        console.log(JSON.stringify(res.rows, null, 2));

        pool.end();
    } catch (e) {
        console.error(e);
        pool.end();
    }
}
debug();
