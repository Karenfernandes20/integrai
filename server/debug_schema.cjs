const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function debug() {
    try {
        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'crm_appointments' AND column_name IN ('start_time', 'end_time')
        `);
        console.log(JSON.stringify(res.rows, null, 2));
        pool.end();
    } catch (e) {
        console.error(e);
        pool.end();
    }
}
debug();
