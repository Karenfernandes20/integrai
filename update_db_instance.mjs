
import pkg from 'pg';
const { Pool } = pkg;

const databaseUrl = "postgresql://postgres:postgres@localhost:5432/viamovecar_hub";

const pool = new Pool({
    connectionString: databaseUrl,
    ssl: false,
});

async function updateInstance() {
    try {
        const res = await pool.query("UPDATE companies SET evolution_instance = 'instegrai' WHERE id = 1 OR evolution_instance = 'integrai' RETURNING *");
        console.log('Update result:', JSON.stringify(res.rows, null, 2));
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

updateInstance();
