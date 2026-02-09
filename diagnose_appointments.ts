
import 'dotenv/config';
import { pool } from './server/db';
import fs from 'fs';

async function diagnose() {
    try {
        console.log("Checking crm_appointments schema...");
        const schema = await pool.query(`
            SELECT column_name, data_type, udt_name 
            FROM information_schema.columns 
            WHERE table_name = 'crm_appointments' 
            AND column_name IN ('start_time', 'end_time');
        `);

        console.log("Checking server timezone...");
        const tz = await pool.query("SHOW TIMEZONE");

        console.log("Checking recent appointments...");
        const appointments = await pool.query(`
            SELECT id, title, start_time, end_time, created_at 
            FROM crm_appointments 
            ORDER BY created_at DESC 
            LIMIT 5
        `);

        // Check raw values
        const raw = await pool.query(`
            SELECT id, start_time::text, end_time::text
            FROM crm_appointments 
            ORDER BY created_at DESC 
            LIMIT 5
        `);

        const results = {
            schema: schema.rows,
            timezone: tz.rows[0],
            appointments: appointments.rows,
            raw: raw.rows
        };

        fs.writeFileSync('diagnose_results.json', JSON.stringify(results, null, 2));
        console.log("Done writing to diagnose_results.json");

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

diagnose();
