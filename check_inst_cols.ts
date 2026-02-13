
import { pool } from './server/db';

async function check() {
    try {
        const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'company_instances'");
        console.log("Columns in company_instances:", res.rows.map(r => r.column_name));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
check();
