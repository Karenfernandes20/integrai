
import 'dotenv/config';
import { pool } from './server/db';
import fs from 'fs';

async function check() {
    let log = '';
    const l = (s: string) => { console.log(s); log += s + '\n'; };

    l('--- Checking Appointments for Today ---');
    l('Current Local Time: ' + new Date().toString());
    l('Current UTC Time: ' + new Date().toISOString());

    try {
        const result = await pool.query(`
            SELECT id, title, start_time, end_time, lead_id, responsible_id 
            FROM crm_appointments 
            ORDER BY created_at DESC 
            LIMIT 10
        `);

        l(`Found ${result.rows.length} recent appointments:`);
        result.rows.forEach(row => {
            l(`ID: ${row.id} | Title: ${row.title} | Start (UTC): ${row.start_time} | End (UTC): ${row.end_time}`);
            const d = new Date(row.start_time);
            l(`   -> Local JS Date: ${d.toString()}`);
        });
    } catch (e: any) {
        l('Error: ' + e.message);
    }

    fs.writeFileSync('appointments_log.txt', log);
    process.exit(0);
}

check();
