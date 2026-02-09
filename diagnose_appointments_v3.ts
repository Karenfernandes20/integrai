
import 'dotenv/config';
import { pool } from './server/db';
import fs from 'fs';

async function diagnose() {
    try {
        const apps = await pool.query(`
            SELECT a.id, a.title, a.company_id, c.name as company_name, a.created_at
            FROM crm_appointments a
            LEFT JOIN companies c ON a.company_id = c.id
            ORDER BY a.created_at DESC
        `);

        fs.writeFileSync('diagnose_results_v3.json', JSON.stringify(apps.rows, null, 2));
        console.log("Done");
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
diagnose();
