
import { pool } from './server/db';
import fs from 'fs';

async function dump() {
    try {
        const res = await pool.query(`
            SELECT id, title, start_time, end_time, created_at, responsible_id, company_id 
            FROM crm_appointments 
            ORDER BY created_at DESC 
            LIMIT 5
        `);
        fs.writeFileSync('appointments_dump.json', JSON.stringify(res.rows, null, 2));
        console.log("Dumped.");
    } catch (e) {
        console.error(e);
    }
    process.exit();
}

dump();
