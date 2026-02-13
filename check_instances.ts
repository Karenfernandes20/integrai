
import './server/env';
import { pool } from './server/db';

async function check() {
    try {
        const res = await pool.query("SELECT instance_key, name FROM company_instances");
        console.log("DB Instances (company_instances):", res.rows);

        const res2 = await pool.query("SELECT evolution_instance FROM companies");
        console.log("Companies Instances (companies):", res2.rows);
    } catch (e: any) {
        console.error(e.message);
    }
    process.exit();
}
check();
