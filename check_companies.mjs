
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    connectionString: "postgresql://postgres:postgres@localhost:5432/viamovecar_hub",
    ssl: false
});

async function check() {
    try {
        const res = await pool.query("SELECT id, name, logo_url FROM companies");
        console.log("Current Companies:");
        console.table(res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

check();
