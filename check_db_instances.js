
import pg from 'pg';
const { Pool } = pg;
import 'dotenv/config';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function check() {
    try {
        const res = await pool.query("SELECT id, name, whatsapp_enabled, whatsapp_limit, evolution_instance FROM companies");
        console.log("Companies:", JSON.stringify(res.rows, null, 2));
        const instRes = await pool.query("SELECT id, company_id, name, instance_key FROM company_instances");
        console.log("Instances:", JSON.stringify(instRes.rows, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
check();
