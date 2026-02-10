
import { pool } from './server/db';

async function main() {
    try {
        const res = await pool.query("SELECT id, start_time, end_time, title FROM crm_appointments ORDER BY id DESC LIMIT 5");
        console.log("--- RAW APPOINTMENTS ---");
        console.log(JSON.stringify(res.rows, null, 2));

        const typeRes = await pool.query("SELECT data_type FROM information_schema.columns WHERE table_name = 'crm_appointments' AND column_name = 'start_time'");
        console.log("--- COLUMN TYPE ---");
        console.log(JSON.stringify(typeRes.rows, null, 2));
    } catch (e) {
        console.error(e);
    }
    process.exit();
}

main();
