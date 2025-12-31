
import pkg from 'pg';
const { Pool } = pkg;

const databaseUrl = "postgresql://postgres:postgres@localhost:5432/viamovecar_hub";

const pool = new Pool({
    connectionString: databaseUrl,
    ssl: false,
});

async function checkInstance() {
    try {
        const res = await pool.query('SELECT id, name, evolution_instance, evolution_apikey FROM companies WHERE id = 1');
        console.log('Company ID 1:', JSON.stringify(res.rows[0], null, 2));
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

checkInstance();
