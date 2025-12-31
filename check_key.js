
const { Pool } = require('pg');

const databaseUrl = "postgresql://postgres:postgres@localhost:5432/viamovecar_hub";

const pool = new Pool({
    connectionString: databaseUrl,
});

async function check() {
    try {
        const res = await pool.query('SELECT id, evolution_apikey FROM companies WHERE id = 1');
        console.log('Current Key Last 5:', res.rows[0].evolution_apikey.slice(-5));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

check();
