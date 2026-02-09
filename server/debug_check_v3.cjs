const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function debug() {
    try {
        console.log("--- DEBUG APPOINTMENT CHECK ---");

        // Check raw values in DB (latest 3)
        const res = await pool.query(`
            SELECT id, title, start_time::text as raw_start, company_id, created_at
            FROM crm_appointments 
            ORDER BY id DESC 
            LIMIT 3
        `);
        console.log("Latest Appointments in DB:");
        console.log(JSON.stringify(res.rows, null, 2));

        pool.end();
    } catch (e) {
        console.error(e);
        pool.end();
    }
}
debug();
