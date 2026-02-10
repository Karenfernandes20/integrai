
import { pool } from './server/db';

async function inspectAppointments() {
    try {
        console.log("--- INSPECTING RECENT APPOINTMENTS ---");
        // Get last 10 appointments created
        const res = await pool.query(`
            SELECT id, title, start_time, end_time, created_at, responsible_id, company_id 
            FROM crm_appointments 
            ORDER BY created_at DESC 
            LIMIT 10
        `);

        console.log(`Found ${res.rows.length} appointments.`);

        res.rows.forEach(row => {
            console.log(`ID: ${row.id} | Title: ${row.title}`);
            console.log(`  Start (DB): ${row.start_time} (Type: ${typeof row.start_time})`);
            console.log(`  End   (DB): ${row.end_time}`);
            console.log(`  Created At: ${row.created_at}`);
            console.log(`  Company ID: ${row.company_id}`);
            console.log("------------------------------------------------");
        });

    } catch (e) {
        console.error(e);
    }
    process.exit();
}

inspectAppointments();
